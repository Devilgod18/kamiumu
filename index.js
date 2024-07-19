const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { prefix } = require('./config.json');
const scdl = require('soundcloud-downloader').default;
const YouTube = require("discord-youtube-api");

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
        isPlayingSoundCloud: false
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
            if (!serverQueue) {
                queue.set(message.guild.id, queueConstruct);
                queueConstruct.songs.push(song);
                try {
                    const connection = await voiceChannel.join();
                    queueConstruct.connection = connection;
                    play(message.guild, queueConstruct.songs[0]);
                } catch (err) {
                    console.log(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(err.message);
                }
            } else {
                serverQueue.songs.push(song);
                message.channel.send(`${song.title} added to the queue!`);
                message.channel.send(`${serverQueue.songs.length} song(s) in queue!`);
            }
        } catch (err) {
            console.error(err);
            message.channel.send('Error while processing SoundCloud track.');
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
                try {
                    const connection = await voiceChannel.join();
                    queueConstruct.connection = connection;
                    play(message.guild, queueConstruct.songs[0]);
                } catch (err) {
                    console.log(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(err.message);
                }
            } else {
                serverQueue.songs.push(song);
                message.channel.send(`${song.title} added to the queue!`);
                message.channel.send(`${serverQueue.songs.length} song(s) in queue!`);
            }
        } catch (err) {
            console.error(err);
            message.channel.send('Error: Invalid YouTube URL');
        }
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue) return message.channel.send('There is no song to skip!');
    if (!serverQueue.connection.dispatcher) return message.channel.send('There is no song currently playing!');

    serverQueue.songs.shift();
    if (serverQueue.songs.length === 0) {
        serverQueue.connection.dispatcher.end();
        message.guild.me.voice.channel.leave();
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
    if (serverQueue.connection.dispatcher) {
        serverQueue.connection.dispatcher.end();
    }
    message.guild.me.voice.channel.leave();
    queue.delete(message.guild.id);
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    let dispatcher;

    if (song.source === 'youtube') {
        dispatcher = serverQueue.connection
            .play(ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio' }))
            .on('finish', () => {
                console.log('Music ended!');
                serverQueue.songs.shift();
                const nextSong = serverQueue.songs[0];
                if (nextSong) {
                    play(guild, nextSong);
                } else {
                    serverQueue.voiceChannel.leave();
                    queue.delete(guild.id);
                }
            })
            .on('error', (error) => console.error(error));
        serverQueue.dispatcher = dispatcher;
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    } else if (song.source === 'soundcloud') {
        dispatcher = serverQueue.connection
            .play(song.url, { highWaterMark: 1 << 25 })
            .on('finish', () => {
                console.log('Music ended!');
                serverQueue.isPlayingSoundCloud = false;
                serverQueue.songs.shift();
                const nextSong = serverQueue.songs[0];
                if (nextSong) {
                    play(guild, nextSong);
                } else {
                    serverQueue.voiceChannel.leave();
                    queue.delete(guild.id);
                }
            })
            .on('error', (error) => console.error(error));
        serverQueue.dispatcher = dispatcher;
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    }
}

client.login(token);
