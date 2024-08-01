const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, InteractionType } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const scdl = require('soundcloud-downloader').default;
const ytpl = require('ytpl');
const { prefix } = require('./config.json');
const YouTube = require('discord-youtube-api');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const token = process.env.token;
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const queues = new Map(); // Use `queues` map for managing multiple voice channels
const async = require('async');

// Create a queue with a limited concurrency (e.g., 1)
const taskQueue = async.queue(async (task, done) => {
    try {
        await task();
    } catch (error) {
        console.error('Error processing task:', error);
    } finally {
        done();
    }
}, 1);

require('events').EventEmitter.defaultMaxListeners = 30;

client.once('ready', () => {
    console.log('Ready!');
});

client.once('reconnecting', () => {
    console.log('Reconnecting!');
});

client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queues.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        await execute(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}pause`)) {
        pause(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}resume`)) {
        resume(message, serverQueue);
    } else {
        message.channel.send('You need to enter a valid command!');
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    const serverQueue = queues.get(interaction.guild.id);

    if (!serverQueue) {
        return interaction.reply({ content: 'There is nothing playing right now.', ephemeral: true });
    }

    switch (interaction.customId) {
        case 'pause':
            pause(interaction.message, serverQueue);
            interaction.reply({ content: 'Playback paused!', ephemeral: true });
            break;
        case 'resume':
            resume(interaction.message, serverQueue);
            interaction.reply({ content: 'Playback resumed!', ephemeral: true });
            break;
        case 'skip':
            skip(interaction.message, serverQueue);
            interaction.reply({ content: 'Song skipped!', ephemeral: true });
            break;
        case 'stop':
            stop(interaction.message, serverQueue);
            interaction.reply({ content: 'Playback stopped!', ephemeral: true });
            break;
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(' ').slice(1);
    const searchString = args.join(' ');
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true,
        isPlayingSoundCloud: false,
        player: null,
        paused: false
    };

    let song = null;
    if (args[0].includes('soundcloud.com')) {
        try {
            const trackInfo = await scdl.getInfo(args[0], process.env.SOUNDCLOUD_CLIENT_ID);
            const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_CLIENT_ID);
            song = {
                title: trackInfo.title,
                url: track,
                source: 'soundcloud'
            };
            taskQueue.push(() => handleQueue(message.guild, voiceChannel.id, queueContruct, song));
        } catch (err) {
            console.log('Error with SoundCloud track:', err);
            message.channel.send('Error retrieving or downloading SoundCloud track.');
        }
    } else if (ytpl.validateID(searchString)) {
        try {
            const playlist = await ytpl(searchString);
            for (const video of playlist.items) {
                const song = {
                    title: video.title,
                    url: video.shortUrl,
                    source: 'youtube'
                };
                taskQueue.push(() => handleQueue(message.guild, voiceChannel.id, queueContruct, song));
            }
            message.channel.send(`${playlist.items.length} Song playlist added to the queue!`);
        } catch (err) {
            console.log('Error with YouTube playlist:', err);
            message.channel.send('Error retrieving YouTube playlist.');
        }
    } else {
        try {
            const songInfo = await ytdl.getInfo(searchString);
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                source: 'youtube'
            };
            taskQueue.push(() => handleQueue(message.guild, voiceChannel.id, queueContruct, song));
        } catch (err) {
            console.log('Error with YouTube video:', err);
            message.channel.send('Error retrieving YouTube video.');
        }
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pause')
                .setLabel('Pause')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏸️'),
            new ButtonBuilder()
                .setCustomId('resume')
                .setLabel('Resume')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('▶️'),
            new ButtonBuilder()
                .setCustomId('skip')
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏭️'),
            new ButtonBuilder()
                .setCustomId('stop')
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🛑')
        );

    message.channel.send({
        content: 'Controls:',
        components: [row]
    });

    if (song) {
        message.channel.send(`Now playing: **${song.title}**`);
    }
}

async function handleQueue(guild, channelId, queueContruct, song) {
    const guildQueue = queues.get(guild.id) || {};
    const voiceChannelQueue = guildQueue[channelId] || {};

    if (!voiceChannelQueue.songs) {
        voiceChannelQueue.songs = [];
        guildQueue[channelId] = voiceChannelQueue;
    }

    if (voiceChannelQueue.songs.length === 0) {
        queueContruct.songs.push(song);
        voiceChannelQueue.songs.push(song);
        queues.set(guild.id, guildQueue);

        const connection = joinVoiceChannel({
            channelId: queueContruct.voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator
        });
        queueContruct.connection = connection;
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                queues.delete(guild.id);
                connection.destroy();
            }
        });
        play(guild, channelId, voiceChannelQueue.songs[0]);
    } else {
        voiceChannelQueue.songs.push(song);
        console.log(`${song.title} added to the queue for channel ${channelId}!`);
    }
}

function skip(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    
    const serverQueue = queues.get(message.guild.id);
    const channelQueue = serverQueue ? serverQueue[voiceChannel.id] : null;

    if (!channelQueue) return message.channel.send('There is no song to skip!');

    channelQueue.songs.shift();
    if (channelQueue.songs.length === 0) {
        if (channelQueue.connection) channelQueue.connection.destroy();
        delete serverQueue[voiceChannel.id];
        if (Object.keys(serverQueue).length === 0) queues.delete(message.guild.id);
        message.channel.send('No more songs in the queue.');
    } else {
        play(message.guild, voiceChannel.id, channelQueue.songs[0]);
    }
    message.channel.send(`Skipped to the next song. ${channelQueue.songs.length} song(s) remaining in the queue. Now playing: **${channelQueue.songs[0].title}**`);
}

function stop(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    
    const serverQueue = queues.get(message.guild.id);
    const channelQueue = serverQueue ? serverQueue[voiceChannel.id] : null;

    if (!channelQueue) return message.channel.send('There is no song to stop!');

    channelQueue.songs = [];
    if (channelQueue.connection) channelQueue.connection.destroy();
    delete serverQueue[voiceChannel.id];
    if (Object.keys(serverQueue).length === 0) queues.delete(message.guild.id);
    message.channel.send('Playback stopped.');
}

function pause(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    
    const serverQueue = queues.get(message.guild.id);
    const channelQueue = serverQueue ? serverQueue[voiceChannel.id] : null;

    if (!channelQueue || !channelQueue.player) return message.channel.send('There is no song playing to pause!');

    if (!channelQueue.paused) {
        channelQueue.player.pause(); // Pause the player
        channelQueue.paused = true;
        message.channel.send('Playback paused!');
    } else {
        message.channel.send('Playback is already paused!');
    }
}

function resume(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    
    const serverQueue = queues.get(message.guild.id);
    const channelQueue = serverQueue ? serverQueue[voiceChannel.id] : null;

    if (!channelQueue || !channelQueue.player) return message.channel.send('There is no song playing to resume!');

    if (channelQueue.paused) {
        channelQueue.player.unpause(); // Resume the player
        channelQueue.paused = false;
        message.channel.send('Playback resumed!');
    } else {
        message.channel.send('Playback is already playing!');
    }
}

function play(guild, channelId, song) {
    const serverQueue = queues.get(guild.id);
    if (!serverQueue) return;

    const channelQueue = serverQueue[channelId];
    if (!channelQueue) return;

    if (!song) {
        if (channelQueue.connection) channelQueue.connection.destroy();
        delete serverQueue[channelId];
        if (Object.keys(serverQueue).length === 0) queues.delete(guild.id);
        return;
    }

    let resource;
    try {
        if (song.source === 'youtube') {
            resource = createAudioResource(ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25 }));
        } else if (song.source === 'soundcloud') {
            resource = createAudioResource(song.url);
        }
    } catch (error) {
        console.error('Error creating audio resource:', error);
        channelQueue.songs.shift();
        if (channelQueue.songs.length > 0) {
            play(guild, channelId, channelQueue.songs[0]);
        } else {
            channelQueue.connection.destroy();
            delete serverQueue[channelId];
            if (Object.keys(serverQueue).length === 0) queues.delete(guild.id);
        }
        return;
    }

    const player = createAudioPlayer();
    channelQueue.player = player;

    player.play(resource);
    channelQueue.connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log('Music ended!');
        channelQueue.songs.shift();
        if (channelQueue.songs.length > 0) {
            play(guild, channelId, channelQueue.songs[0]);
        } else {
            channelQueue.connection.destroy();
            delete serverQueue[channelId];
            if (Object.keys(serverQueue).length === 0) queues.delete(guild.id);
        }
    });

    player.on('error', (error) => console.error('Player Error:', error));

    channelQueue.textChannel.send(`Now playing: **${song.title}**`).then(() => {
        // Create and send the button controls after announcing the song
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pause')
                    .setLabel('Pause')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏸️'),
                new ButtonBuilder()
                    .setCustomId('resume')
                    .setLabel('Resume')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('▶️'),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏭️'),
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🛑')
            );

        channelQueue.textChannel.send({
            content: 'Controls:',
            components: [row]
        });
    });
}

client.login(token);



