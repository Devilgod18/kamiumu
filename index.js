const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { prefix } = require('./config.json');
const scdl = require('soundcloud-downloader').default;
const ytpl = require('ytpl');
const YouTube = require("discord-youtube-api");
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
require('events').EventEmitter.defaultMaxListeners = 20;

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

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        await execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send('You need to enter a valid command!');
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    const serverQueue = queue.get(interaction.guild.id);

    switch (interaction.customId) {
        case 'play':
            if (serverQueue && serverQueue.songs.length > 0) {
                play(interaction.guild, serverQueue.songs[0]);
                await interaction.reply('Playback started.');
            } else {
                await interaction.reply('No song in the queue.');
            }
            break;
        case 'pause':
            pause(interaction, serverQueue);
            await interaction.reply('Playback paused.');
            break;
        case 'stop':
            stop(interaction, serverQueue);
            await interaction.reply('Playback stopped.');
            break;
        case 'skip':
            skip(interaction, serverQueue);
            await interaction.reply('Skipped to next song.');
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
        player: null
    };

    let song = null;
    if (args[0].includes('soundcloud.com')) {
        // Download SoundCloud track
        const trackInfo = await scdl.getInfo(args[0], process.env.SOUNDCLOUD_CLIENT_ID);
        const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_CLIENT_ID);
        song = {
            title: trackInfo.title,
            url: track,
            source: 'soundcloud'
        };
        if (!serverQueue) {
            queue.set(message.guild.id, queueContruct);
            queueContruct.songs.push(song);
            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator
                });
                queueContruct.connection = connection;
                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch (error) {
                        queue.delete(message.guild.id);
                        connection.destroy();
                    }
                });
                play(message.guild, queueContruct.songs[0]);
            } catch (err) {
                console.log(err);
                queue.delete(message.guild.id);
                return message.channel.send(err.message);
            }
        } else {
            serverQueue.songs.push(song);
            message.channel.send(`${song.title} added to the queue!`);
        }
    } else if (ytpl.validateID(searchString)) {
        const playlist = await ytpl(searchString);
        for (const video of playlist.items) {
            const song = {
                title: video.title,
                url: video.shortUrl,
                source: 'youtube'
            };
            if (!serverQueue) {
                queue.set(message.guild.id, queueContruct);
                queueContruct.songs.push(song);
                try {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator
                    });
                    queueContruct.connection = connection;
                    connection.on(VoiceConnectionStatus.Disconnected, async () => {
                        try {
                            await Promise.race([
                                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                            ]);
                        } catch (error) {
                            queue.delete(message.guild.id);
                            connection.destroy();
                        }
                    });
                    play(message.guild, queueContruct.songs[0]);
                } catch (err) {
                    console.log(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(err.message);
                }
            } else {
                serverQueue.songs.push(song);
                message.channel.send(`${song.title} added to the queue!`);
            }
        }
        message.channel.send(`${playlist.items.length} Song playlist added to the queue!`);
    } else {
        try {
            const songInfo = await ytdl.getInfo(searchString);
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                source: 'youtube'
            };
            if (!serverQueue) {
                queue.set(message.guild.id, queueContruct);
                queueContruct.songs.push(song);
                try {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator
                    });
                    queueContruct.connection = connection;
                    connection.on(VoiceConnectionStatus.Disconnected, async () => {
                        try {
                            await Promise.race([
                                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                            ]);
                        } catch (error) {
                            queue.delete(message.guild.id);
                            connection.destroy();
                        }
                    });
                    play(message.guild, queueContruct.songs[0]);
                } catch (err) {
                    console.log(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(err.message);
                }
            } else {
                serverQueue.songs.push(song);
                message.channel.send(`${song.title} added to the queue!`);
            }
        } catch (err) {
            message.channel.send('Error: Invalid YouTube URL');
        }
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue) return message.channel.send('There is no song to skip!');

    serverQueue.songs.shift();
    if (serverQueue.songs.length === 0) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        queue.delete(message.guild.id);
    } else {
        play(message.guild, serverQueue.songs[0]);
    }

    message.channel.send(`${serverQueue.songs.length} song(s) in queue!`);
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue) return message.channel.send('There is no song to stop!');

    serverQueue.songs = [];
    if (serverQueue.connection) serverQueue.connection.destroy();
    queue.delete(message.guild.id);
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    let resource;
    if (song.source === 'youtube') {
        resource = createAudioResource(ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 }));
    } else if (song.source === 'soundcloud') {
        resource = createAudioResource(song.url);
    }

    const player = createAudioPlayer();
    serverQueue.player = player; // Store the player in serverQueue

    player.play(resource);

    serverQueue.connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log('Music ended!');
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guild, serverQueue.songs[0]);
        } else {
            serverQueue.connection.destroy();
            queue.delete(guild.id);
        }
    });

    player.on('error', (error) => console.error(error));
}

function pause(interaction, serverQueue) {
    if (!serverQueue || !serverQueue.player) {
        return interaction.reply('There is no music playing to pause!');
    }
    serverQueue.player.pause();
}

function resume(interaction, serverQueue) {
    if (!serverQueue || !serverQueue.player) {
        return interaction.reply('There is no music playing to resume!');
    }
    serverQueue.player.unpause();
}

function createControlButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('play')
                .setLabel('▶️ Play')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('pause')
                .setLabel('⏸️ Pause')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setLabel('🛑 Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('skip')
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Primary)
        );
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        await execute(message, serverQueue);
        message.channel.send({ content: 'Controls:', components: [createControlButtons()] });
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send('You need to enter a valid command!');
    }
});

client.login(token);
