const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
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

const queue = new Map();
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

    const voiceChannelId = message.member.voice.channel?.id;
    if (!voiceChannelId) return message.channel.send('You need to be in a voice channel!');
    
    const guildQueue = queue.get(message.guild.id) || {};
    queue.set(message.guild.id, guildQueue);
    
    const serverQueue = guildQueue[voiceChannelId] || {
        textChannel: message.channel,
        voiceChannel: message.member.voice.channel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true,
        isPlayingSoundCloud: false,
        player: null,
        paused: false
    };
    guildQueue[voiceChannelId] = serverQueue;

    if (message.content.startsWith(`${prefix}play`)) {
        await execute(message, serverQueue, voiceChannelId);
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue, voiceChannelId);
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue, voiceChannelId);
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

    const voiceChannelId = interaction.member.voice.channel?.id;
    if (!voiceChannelId) return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });

    const serverQueue = queue.get(interaction.guild.id)?.[voiceChannelId];

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
            skip(interaction.message, serverQueue, voiceChannelId);
            interaction.reply({ content: 'Song skipped!', ephemeral: true });
            break;
        case 'stop':
            stop(interaction.message, serverQueue, voiceChannelId);
            interaction.reply({ content: 'Playback stopped!', ephemeral: true });
            break;
    }
});

async function execute(message, serverQueue, voiceChannelId) {
    const args = message.content.split(' ').slice(1);
    const searchString = args.join(' ');
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

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
            taskQueue.push(() => handleQueue(message.guild, voiceChannelId, serverQueue, song));
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
                taskQueue.push(() => handleQueue(message.guild, voiceChannelId, serverQueue, song));
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
            taskQueue.push(() => handleQueue(message.guild, voiceChannelId, serverQueue, song));
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

async function handleQueue(guild, voiceChannelId, serverQueue, song) {
    const guildQueue = queue.get(guild.id);
    const voiceChannelQueue = guildQueue[voiceChannelId] || {
        ...serverQueue,
        songs: []
    };

    if (!guildQueue[voiceChannelId]) {
        guildQueue[voiceChannelId] = voiceChannelQueue;
        queue.set(guild.id, guildQueue);
    }

    voiceChannelQueue.songs.push(song);

    if (!voiceChannelQueue.connection) {
        const connection = joinVoiceChannel({
            channelId: voiceChannelQueue.voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator
        });
        voiceChannelQueue.connection = connection;

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                delete guildQueue[voiceChannelId];
                if (Object.keys(guildQueue).length === 0) {
                    queue.delete(guild.id);
                }
                connection.destroy();
            }
        });

        play(guild, voiceChannelId, voiceChannelQueue.songs[0]);
    } else {
        console.log(`${song.title} added to the queue for channel ${voiceChannelId}!`);
    }
}

function play(guild, voiceChannelId, song) {
    const serverQueue = queue.get(guild.id)[voiceChannelId];

    if (!song) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        delete queue.get(guild.id)[voiceChannelId];
        if (Object.keys(queue.get(guild.id)).length === 0) {
            queue.delete(guild.id);
        }
        return;
    }

    let resource;
    try {
        if (song.source === 'soundcloud') {
            resource = createAudioResource(song.url, { inlineVolume: true });
        } else {
            resource = createAudioResource(ytdl(song.url, { filter: 'audioonly' }), { inlineVolume: true });
        }
    } catch (error) {
        console.error('Error creating audio resource:', error);
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guild, voiceChannelId, serverQueue.songs[0]);
        } else {
            if (serverQueue.connection) serverQueue.connection.destroy();
            delete queue.get(guild.id)[voiceChannelId];
            if (Object.keys(queue.get(guild.id)).length === 0) {
                queue.delete(guild.id);
            }
        }
        return;
    }

    const player = createAudioPlayer();
    serverQueue.player = player;

    player.play(resource);
    serverQueue.connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log('Music ended!');
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guild, voiceChannelId, serverQueue.songs[0]);
        } else {
            if (serverQueue.connection) serverQueue.connection.destroy();
            delete queue.get(guild.id)[voiceChannelId];
            if (Object.keys(queue.get(guild.id)).length === 0) {
                queue.delete(guild.id);
            }
        }
    });

    player.on('error', (error) => console.error('Player Error:', error));

    serverQueue.textChannel.send(`Now playing: **${song.title}**`);
}

function skip(message, serverQueue, voiceChannelId) {
    if (!serverQueue) return message.channel.send('There is no song to skip!');

    serverQueue.songs.shift();
    if (serverQueue.songs.length === 0) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        delete queue.get(message.guild.id)[voiceChannelId];
        if (Object.keys(queue.get(message.guild.id)).length === 0) {
            queue.delete(message.guild.id);
        }
        message.channel.send('No more songs in the queue.');
    } else {
        play(message.guild, voiceChannelId, serverQueue.songs[0]);
    }
    message.channel.send(`Skipped to the next song. ${serverQueue.songs.length} song(s) remaining in the queue. Now playing: **${serverQueue.songs[0].title}**`);
}

function stop(message, serverQueue, voiceChannelId) {
    if (!serverQueue) return message.channel.send('There is no song to stop!');

    serverQueue.songs = [];
    if (serverQueue.connection) serverQueue.connection.destroy();
    delete queue.get(message.guild.id)[voiceChannelId];
    if (Object.keys(queue.get(message.guild.id)).length === 0) {
        queue.delete(message.guild.id);
    }
    message.channel.send('Playback stopped.');
}

function pause(message, serverQueue) {
    if (!serverQueue || !serverQueue.player) return message.channel.send('There is no song playing to pause!');

    if (!serverQueue.paused) {
        serverQueue.player.pause();
        serverQueue.paused = true;
        message.channel.send('Playback paused!');
    } else {
        message.channel.send('Playback is already paused!');
    }
}

function resume(message, serverQueue) {
    if (!serverQueue || !serverQueue.player) return message.channel.send('There is no song playing to resume!');

    if (serverQueue.paused) {
        serverQueue.player.unpause();
        serverQueue.paused = false;
        message.channel.send('Playback resumed!');
    } else {
        message.channel.send('Playback is already playing!');
    }
}

client.login(token);
