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
require('events').EventEmitter.defaultMaxListeners = 50;

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
    } else if (message.content.startsWith(`${prefix}reverse`)) {
        reverse(message, serverQueue);
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
            await interaction.reply({ content: 'Playback paused!', ephemeral: true });
            break;
        case 'resume':
            resume(interaction.message, serverQueue);
            await interaction.reply({ content: 'Playback resumed!', ephemeral: true });
            break;
        case 'skip':
            skip(interaction.message, serverQueue);
            await interaction.reply({ content: 'Song skipped!', ephemeral: true });
            break;
        case 'stop':
            stop(interaction.message, serverQueue);
            await interaction.reply({ content: 'Playback stopped!', ephemeral: true });
            break;
        case 'reverse':
            reverse(interaction.message, serverQueue);
            await interaction.reply({ content: 'Reversed to the previous song!', ephemeral: true });
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
        paused: false,
        previousSong: null
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

    // Create and send the buttons
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
                .setCustomId('stop')
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🛑'),
            new ButtonBuilder()
                .setCustomId('reverse')
                .setLabel('Reverse')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏮️'),
            new ButtonBuilder()
                .setCustomId('skip')
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏭️')
        );

    message.channel.send({
        content: 'Controls:',
        components: [row]
    });
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    const player = createAudioPlayer();

    const resource = createAudioResource(song.url, {
        inputType: ytdl.validateURL(song.url) ? AudioPlayerStatus.Playing : AudioPlayerStatus.Idle
    });

    player.play(resource);
    serverQueue.connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guild, serverQueue.songs[0]);
        } else {
            serverQueue.connection.destroy();
            queue.delete(guild.id);
        }
    });
}

function skip(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue.player.stop();
    message.channel.send('Skipped the song!');
}

function stop(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song that I could stop!');
    serverQueue.songs = [];
    serverQueue.player.stop();
    message.channel.send('Stopped the music!');
}

function pause(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song playing!');
    serverQueue.player.pause();
    serverQueue.paused = true;
}

function resume(message, serverQueue) {
    if (!serverQueue) return message.channel.send('There is no song playing!');
    if (!serverQueue.paused) return message.channel.send('The song is not paused!');
    serverQueue.player.unpause();
    serverQueue.paused = false;
}

function reverse(message, serverQueue) {
    if (!serverQueue || !serverQueue.previousSong) return message.channel.send('There is no previous song to reverse to!');
    serverQueue.songs.unshift(serverQueue.previousSong);
    serverQueue.previousSong = null;
    play(message.guild, serverQueue.songs[0]);
}

client.login(token);
