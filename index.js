const { Client, GatewayIntentBits, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { prefix } = require('./config.json');
const scdl = require('soundcloud-downloader').default;
const ytpl = require('ytpl');
const YouTube = require("discord-youtube-api");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { token, YOUTUBE_API_KEY, SOUNDCLOUD_CLIENT_ID } = process.env;
const youtube = new YouTube(YOUTUBE_API_KEY);

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
    } else if (message.content.startsWith(`${prefix}reverse`)) {
        reverse(message, serverQueue);
        return;
    } else {
        message.channel.send('You need to enter a valid command!');
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const serverQueue = queue.get(interaction.guild.id);
    if (!serverQueue) {
        interaction.reply('There is no song currently playing.');
        return;
    }

    switch (interaction.customId) {
        case 'pause':
            pause(interaction, serverQueue);
            break;
        case 'play':
            playResume(interaction, serverQueue);
            break;
        case 'skip':
            skip(interaction, serverQueue);
            break;
        case 'stop':
            stop(interaction, serverQueue);
            break;
        case 'reverse':
            reverse(interaction, serverQueue);
            break;
        default:
            interaction.reply('Unknown button action.');
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
        player: createAudioPlayer(),
        songHistory: []
    };

    let song = null;
    try {
        if (args[0].includes('soundcloud.com')) {
            const trackInfo = await scdl.getInfo(args[0], SOUNDCLOUD_CLIENT_ID);
            const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, SOUNDCLOUD_CLIENT_ID);
            song = {
                title: trackInfo.title,
                url: track,
                source: 'soundcloud'
            };
        } else if (ytpl.validateID(searchString)) {
            const playlist = await ytpl(searchString);
            if (playlist.items.length === 0) {
                return message.channel.send('Playlist is empty!');
            }
            for (const video of playlist.items) {
                const song = {
                    title: video.title,
                    url: video.shortUrl,
                    source: 'youtube'
                };
                if (!serverQueue) {
                    queue.set(message.guild.id, queueContruct);
                    queueContruct.songs.push(song);
                } else {
                    serverQueue.songs.push(song);
                    message.channel.send(`${song.title} added to the queue!`);
                }
            }
            message.channel.send(`${playlist.items.length} Song playlist added to the queue!`);
        } else {
            const songInfo = await ytdl.getInfo(searchString);
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                source: 'youtube'
            };
        }

        if (!song) {
            return message.channel.send('Error: No valid song found');
        }

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
                return message.channel.send('Failed to join the voice channel.');
            }
        } else {
            serverQueue.songs.push(song);
            message.channel.send(`${song.title} added to the queue!`);
        }

        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pause')
                .setEmoji('⏸️') // Pause emoji
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('play')
                .setEmoji('▶️') // Play emoji
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('stop')
                .setEmoji('⏹️') // Stop emoji
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('reverse')
                .setEmoji('⏪') // Rewind emoji for reverse
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('skip')
                .setEmoji('⏩') // Skip emoji
                .setStyle(ButtonStyle.Secondary)
        );

        message.channel.send({ content: 'Use the buttons below to control the music:', components: [row] });
    } catch (error) {
        console.error(error);
        message.channel.send('There was an error processing your request.');
    }
}

function skip(interaction, serverQueue) {
    if (!interaction.member.voice.channel) return interaction.reply('You need to be in a voice channel!');
    if (!serverQueue) return interaction.reply('There is no song to skip!');

    const currentSong = serverQueue.songs[0];
    serverQueue.songHistory.push(currentSong); // Add current song to history
    serverQueue.songs.shift();
    if (serverQueue.songs.length === 0) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        queue.delete(interaction.guild.id);
    } else {
        play(interaction.guild, serverQueue.songs[0]);
    }

    interaction.reply(`Skipped: ${currentSong.title}. Now playing: ${serverQueue.songs[0] ? serverQueue.songs[0].title : 'nothing'}.`);
}

function stop(interaction, serverQueue) {
    if (!interaction.member.voice.channel) return interaction.reply('You need to be in a voice channel!');
    if (!serverQueue) return interaction.reply('There is no song to stop!');

    const currentSong = serverQueue.songs[0];
    serverQueue.songs = [];
    if (serverQueue.connection) serverQueue.connection.destroy();
    queue.delete(interaction.guild.id);
    interaction.reply(`Stopped playing: ${currentSong.title}`);
}

function reverse(interaction, serverQueue) {
    if (!interaction.member.voice.channel) return interaction.reply('You need to be in a voice channel!');
    if (!serverQueue) return interaction.reply('There is no song to reverse to!');

    const lastSong = serverQueue.songHistory.pop(); // Get the last song from history
    if (lastSong) {
        serverQueue.songs.unshift(lastSong); // Add the last song to the front of the queue
        play(interaction.guild, lastSong);
        interaction.reply(`Reversed to: ${lastSong.title}`);
    } else {
        interaction.reply('No previous song to reverse to!');
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    let resource;
    try {
        if (song.source === 'youtube') {
            resource = createAudioResource(ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 }));
        } else if (song.source === 'soundcloud') {
            resource = createAudioResource(song.url);
        }

        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);

        serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            console.log('Music ended!');
            serverQueue.songHistory.push(serverQueue.songs[0]); // Add current song to history
            serverQueue.songs.shift();
            if (serverQueue.songs.length > 0) {
                play(guild, serverQueue.songs[0]);
            } else {
                serverQueue.connection.destroy();
                queue.delete(guild.id);
            }
        });

        serverQueue.player.on('error', (error) => console.error('Error playing audio:', error));
    } catch (error) {
        console.error('Error creating audio resource:', error);
    }
}

function pause(interaction, serverQueue) {
    if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
        serverQueue.player.pause();
        interaction.reply('Paused the current song.');
    } else {
        interaction.reply('The song is already paused!');
    }
}

function playResume(interaction, serverQueue) {
    if (serverQueue.player.state.status === AudioPlayerStatus.Paused) {
        serverQueue.player.unpause();
        interaction.reply('Resumed the current song.');
    } else {
        interaction.reply('Music is already playing!');
    }
}

client.login(token);
