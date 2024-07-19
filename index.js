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
        await execute(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
    } else {
        message.channel.send('You need to enter a valid command!');
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
        console.log('User not in a voice channel');
        return message.channel.send('You need to be in a voice channel to play music!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        console.log('Bot lacks permissions to connect or speak');
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        player: null,
        songs: [],
        volume: 5,
        playing: true
    };

    let song = null;
    try {
        if (args[1].includes('soundcloud.com')) {
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
            queueConstruct.songs.push(song);
            for (let i = 1; i < ytPlaylist.length; i++) {
                const songInfo = await youtube.getVideo(ytPlaylist[i].url);
                queueConstruct.songs.push({
                    title: songInfo.title,
                    url: songInfo.url,
                    source: 'youtube'
                });
            }
        } else {
            const songInfo = await ytdl.getInfo(args[1]);
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                source: 'youtube'
            };
        }
    } catch (error) {
        console.error('Error fetching song information:', error);
        return message.channel.send('There was an error trying to fetch the song information.');
    }

    if (!serverQueue) {
        queue.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);
        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            });
            queueConstruct.connection = connection;
            queueConstruct.player = createAudioPlayer();
            connection.subscribe(queueConstruct.player);

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('Successfully connected to the voice channel');
            });

            connection.on(VoiceConnectionStatus.Disconnected, (oldState, newState) => {
                console.log('Disconnected from the voice channel:', oldState, newState);
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                console.log('Voice connection was destroyed');
            });

            play(message.guild, queueConstruct.songs[0]);
        } catch (err) {
            console.error('Error joining the voice channel:', err);
            queue.delete(message.guild.id);
            return message.channel.send('There was an error trying to join the voice channel.');
        }
    } else {
        serverQueue.songs.push(song);
        message.channel.send(`${song.title} added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to skip the music!');
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
    serverQueue.player.on('error', error => console.error('Audio player error:', error));

    serverQueue.textChannel.send(`Now playing: ${song.title}`);
}

client.login(process.env.token);
