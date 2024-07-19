const { Client, GatewayIntentBits } = require('discord.js');
const { prefix } = require('./config.json');
const ytdl = require('@distube/ytdl-core');
const ytpl = require('ytpl');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const YouTube = require('discord-youtube-api');
const DabiImages = require('dabi-images');
const DabiClient = new DabiImages.Client();
const scdl = require('soundcloud-downloader').default;
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);
const queue = new Map();
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildVoiceStates 
    ]
});

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
        execute(message, serverQueue);
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
    const args = message.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        player: null,
        songs: [],
        volume: 5,
        playing: true,
        isPlayingSoundCloud: false
    };

    let song = null;
    if (args[1].includes('soundcloud.com')) {
        // Download SoundCloud track
        const trackInfo = await scdl.getInfo(args[1], process.env.SOUNDCLOUD_CLIENT_ID);
        const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_CLIENT_ID);
        song = {
            title: trackInfo.title,
            url: track,
            source: 'soundcloud'
        };
    } else if (ytpl.validateID(searchString)) {
        const ytPlaylist = await youtube.getPlaylist(searchString);
        const songInfo = await youtube.getVideo(ytPlaylist[0].url);
        song = {
            title: songInfo.title,
            url: songInfo.url,
            source: 'youtube'
        };
        queueContruct.songs.push(song);
        for (let i = 1; i < ytPlaylist.length; i++) {
            const songInfo = await youtube.getVideo(ytPlaylist[i].url);
            const song = {
                title: songInfo.title,
                url: songInfo.url,
                source: 'youtube'
            };
            queueContruct.songs.push(song);
        }
    } else {
        const songInfo = await ytdl.getInfo(args[1]);
        song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            source: 'youtube'
        };
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
            queueContruct.player = createAudioPlayer();
            connection.subscribe(queueContruct.player);
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        message.channel.send(`${song.title} added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue.player.stop();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could stop!');
    serverQueue.songs = [];
    serverQueue.player.stop();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    let resource = null;
    if (song.source === 'youtube') {
        resource = createAudioResource(ytdl(song.url, { filter: 'audioonly' }));
    } else if (song.source === 'soundcloud') {
        resource = createAudioResource(song.url);
    }

    serverQueue.player.play(resource);
    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });
    serverQueue.player.on('error', error => console.error(error));

    serverQueue.textChannel.send(`Now playing: ${song.title}`);
}

client.login(process.env.token);
