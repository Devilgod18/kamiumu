const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, AudioPlayer, AudioResource } = require('@discordjs/voice');
const DisTube = require('distube');
const { YouTube } = require('discord-youtube-api');
const ytpl = require('ytpl');
const scdl = require('soundcloud-downloader').default;
const token = process.env.token;
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);
const { prefix } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ]
});

const distube = new DisTube(client, {
    leaveOnFinish: true,
    leaveOnStop: true,
    emitNewSongOnly: true,
    highWaterMark: 1 << 25
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

    const args = message.content.split(' ');
    const command = args.shift().slice(prefix.length).toLowerCase();

    switch (command) {
        case 'play':
            await play(message, args.join(' '));
            break;
        case 'skip':
            skip(message);
            break;
        case 'stop':
            stop(message);
            break;
        default:
            message.channel.send('You need to enter a valid command!');
    }
});

async function play(message, query) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    let song;
    if (query.includes('soundcloud.com')) {
        // Handle SoundCloud tracks
        const trackInfo = await scdl.getInfo(query, process.env.SOUNDCLOUD_CLIENT_ID);
        const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_CLIENT_ID);
        song = {
            title: trackInfo.title,
            url: track,
            source: 'soundcloud'
        };
    } else if (ytpl.validateID(query)) {
        // Handle YouTube playlists
        const ytPlaylist = await youtube.getPlaylist(query);
        const songs = [];
        for (const video of ytPlaylist) {
            const songInfo = await youtube.getVideo(video.url);
            songs.push({
                title: songInfo.title,
                url: songInfo.url
            });
        }
        distube.play(voiceChannel, songs, {
            message,
            textChannel: message.channel
        });
        message.channel.send(`${songs.length} Song(s) added to the queue!`);
    } else {
        // Handle single YouTube videos
        const songInfo = await distube.search(query);
        if (songInfo.length > 0) {
            song = songInfo[0];
            distube.play(voiceChannel, song.url, {
                message,
                textChannel: message.channel
            });
            message.channel.send(`${song.name} added to the queue!`);
        } else {
            message.channel.send('No song found.');
        }
    }
}

function skip(message) {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.channel.send('There is no song to skip!');
    distube.skip(message.guildId);
    message.channel.send('Skipped to the next song!');
}

function stop(message) {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.channel.send('There is no song to stop!');
    distube.stop(message.guildId);
    message.channel.send('Stopped the music and cleared the queue.');
}

client.login(token);
