const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, InteractionType } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { prefix } = require('./config.json');
const scdl = require('soundcloud-downloader').default;
const ytpl = require('ytpl');
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

// Ensure the maximum listeners is set to a higher number to prevent warnings
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

    const serverQueue = queue.get(message.guild.id);

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

    const serverQueue = queue.get(interaction.guild.id);

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

    const queueConstruct = {
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
            // Download SoundCloud track
            const trackInfo = await scdl.getInfo(args[0], process.env.SOUNDCLOUD_CLIENT_ID);
            const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_CLIENT_ID);
            song = {
                title: trackInfo.title,
                url: track,
                source: 'soundcloud'
            };
            if (!serverQueue) {
                queue.set(message.guild.id, queueConstruct);
                queueConstruct.songs.push(song);
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator
                });
                queueConstruct.connection = connection;
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
                play(message.guild, queueConstruct.songs[0]);
            } else {
                serverQueue.songs.push(song);
                message.channel.send(`${song.title} added to the queue!`);
            }
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
                if (!serverQueue) {
                    queue.set(message.guild.id, queueConstruct);
                    queueConstruct.songs.push(song);
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator
                    });
                    queueConstruct.connection = connection;
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
                    play(message.guild, queueConstruct.songs[0]);
                } else {
                    serverQueue.songs.push(song);
                    message.channel.send(`${song.title} added to the queue!`);
                }
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
            if (!serverQueue) {
                queue.set(message.guild.id, queueConstruct);
                queueConstruct.songs.push(song);
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator
                });
                queueConstruct.connection = connection;
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
                play(message.guild, queueConstruct.songs[0]);
            } else {
                serverQueue.songs.push(song);
                message.channel.send(`${song.title} added to the queue!`);
            }
        } catch (err) {
            console.log('Error with YouTube song:', err);
            message.channel.send('Error retrieving YouTube song.');
        }
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    const resource = createAudioResource(ytdl(song.url, { filter: 'audioonly' }), {
        inlineVolume: true,
        highWaterMark: 1 << 25 // 32 MB
    });
    const player = createAudioPlayer();
    serverQueue.player = player;

    player.play(resource);
    serverQueue.connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });

    player.on('error', error => {
        console.error('Audio Player Error:', error);
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });

    player.on('stateChange', (oldState, newState) => {
        if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        }
    });

    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

function skip(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue.player.stop();
    message.channel.send('Skipped the current song!');
}

function stop(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song that I could stop!');
    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.channel.send('Stopped the music and cleared the queue!');
}

function pause(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song that I could pause!');
    serverQueue.player.pause();
    serverQueue.paused = true;
}

function resume(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song that I could resume!');
    if (!serverQueue.paused) return message.channel.send('The song is not paused!');
    serverQueue.player.unpause();
    serverQueue.paused = false;
}

client.login(token);
