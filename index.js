﻿const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, InteractionType } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const scdl = require('soundcloud-downloader').default;
const ytpl = require('ytpl');
const { prefix } = require('./config.json');
const YouTube = require('discord-youtube-api');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const token = process.env.token;
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);

// Replace these with your actual cookie values from EditThisCookie
const cookies = [
  
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.351173,
    "hostOnly": false,
    "httpOnly": false,
    "name": "__Secure-1PAPISID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "niPKWaU4ljm6sord/A1N09p-Ha-OPrFOSn",
    "id": 1
},
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.351292,
    "hostOnly": false,
    "httpOnly": true,
    "name": "__Secure-1PSID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "g.a000mAjrg_tsgRAegxfz73becCejuuFF1e0BLs9DvFoykpTRah3SsDoatGB57qYWfShfIDM3OQACgYKAbwSARMSFQHGX2Mi-8OQPMs7uN9mijC49pJ9thoVAUF8yKpOq__3SljSOmbrxpbdtmtc0076",
    "id": 2
},
{
    "domain": ".youtube.com",
    "expirationDate": 1754616021.547263,
    "hostOnly": false,
    "httpOnly": true,
    "name": "__Secure-1PSIDCC",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "AKEyXzXGJjrnjonTFbD4gocY2Q13TrIru-LLTMjft-uSO_RYsN9qlyiVFgQNbFG_cpUc6ZAdvNd8",
    "id": 3
},
{
    "domain": ".youtube.com",
    "expirationDate": 1754615640.559632,
    "hostOnly": false,
    "httpOnly": true,
    "name": "__Secure-1PSIDTS",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "sidts-CjIB4E2dkfWboqLwtF45TxJ4lPwXMF-EgJ5Vui9IFPbhp6h67AEYGXAn8GskTx62SxUlExAA",
    "id": 4
},
{
    "domain": ".youtube.com",
    "expirationDate": 1757513787.4438,
    "hostOnly": false,
    "httpOnly": false,
    "name": "__Secure-3PAPISID",
    "path": "/",
    "sameSite": "no_restriction",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "niPKWaU4ljm6sord/A1N09p-Ha-OPrFOSn",
    "id": 5
},
{
    "domain": ".youtube.com",
    "expirationDate": 1757513787.444059,
    "hostOnly": false,
    "httpOnly": true,
    "name": "__Secure-3PSID",
    "path": "/",
    "sameSite": "no_restriction",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "g.a000mAjrg_tsgRAegxfz73becCejuuFF1e0BLs9DvFoykpTRah3S27fyBOb11V8bPQHb1LIfSgACgYKAa4SARMSFQHGX2MiRuprmErv0SdFJpNhftUoORoVAUF8yKqkk621tE7rvKyXROxgpwgT0076",
    "id": 6
},
{
    "domain": ".youtube.com",
    "expirationDate": 1754616021.547283,
    "hostOnly": false,
    "httpOnly": true,
    "name": "__Secure-3PSIDCC",
    "path": "/",
    "sameSite": "no_restriction",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "AKEyXzVOvXDUgxcT_-jgDOFeWECDKmTXtXY9iuz9RVxwBGj5GH1EEtTVbQwyg6fkcR1qtuSuEtE",
    "id": 7
},
{
    "domain": ".youtube.com",
    "expirationDate": 1754615640.559723,
    "hostOnly": false,
    "httpOnly": true,
    "name": "__Secure-3PSIDTS",
    "path": "/",
    "sameSite": "no_restriction",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "sidts-CjIB4E2dkfWboqLwtF45TxJ4lPwXMF-EgJ5Vui9IFPbhp6h67AEYGXAn8GskTx62SxUlExAA",
    "id": 8
},
{
    "domain": ".youtube.com",
    "expirationDate": 1746599927.768578,
    "hostOnly": false,
    "httpOnly": false,
    "name": "_ga",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "GA1.1.1356055939.1710742377",
    "id": 9
},
{
    "domain": ".youtube.com",
    "expirationDate": 1745302404.927879,
    "hostOnly": false,
    "httpOnly": false,
    "name": "_ga_5RPMD1E2GM",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "GS1.1.1710742376.1.1.1710742404.32.0.0",
    "id": 10
},
{
    "domain": ".youtube.com",
    "expirationDate": 1745302390.053261,
    "hostOnly": false,
    "httpOnly": false,
    "name": "_ga_R3HTL8G9BH",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "GS1.2.1710742390.1.0.1710742390.0.0.0",
    "id": 11
},
{
    "domain": ".youtube.com",
    "expirationDate": 1746599936.693663,
    "hostOnly": false,
    "httpOnly": false,
    "name": "_ga_VCGEPY40VB",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "GS1.1.1712039927.2.1.1712039936.51.0.0",
    "id": 12
},
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.351144,
    "hostOnly": false,
    "httpOnly": false,
    "name": "APISID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "6lkf3haUrG_9-bA_/A1Dg6saPXyS8tf86v",
    "id": 13
},
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.35096,
    "hostOnly": false,
    "httpOnly": true,
    "name": "HSID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "AIIepua8bWh71gwE_",
    "id": 14
},
{
    "domain": ".youtube.com",
    "expirationDate": 1757639899.214563,
    "hostOnly": false,
    "httpOnly": true,
    "name": "LOGIN_INFO",
    "path": "/",
    "sameSite": "no_restriction",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "AFmmF2swRAIgKd9J7lbu5KvEaBNgwIg8snmrWWHYDDmxZN1h326dOl4CID9pbNFDB0w067hJZ36LuKlazw052f_9ol1mTJ2N2gR5:QUQ3MjNmeV9NcmQtMVEwOE1YQTVNSzRBMjRMa25mcGJKWW5kVVd1R1cwLTllaFRUVzV0ZkpFbGwwZ3Y4aDZlZTRaeFJtTnduWWJkVFZpWHJLZWtXWDNoeG54QVF6ZE9nUVZzd0RybFpVQThvYjlRY3lnbVJPcGtMd0djTGpteUlnem43RGZCU0ZULWdCZGN5ZThUV0ZMOE5OUGEtdHR3RWlR",
    "id": 15
},
{
    "domain": ".youtube.com",
    "expirationDate": 1757639906.535705,
    "hostOnly": false,
    "httpOnly": false,
    "name": "PREF",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "f6=40000000&f7=4100&tz=America.Chicago&f5=30000",
    "id": 16
},
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.351158,
    "hostOnly": false,
    "httpOnly": false,
    "name": "SAPISID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "niPKWaU4ljm6sord/A1N09p-Ha-OPrFOSn",
    "id": 17
},
{
    "domain": ".youtube.com",
    "expirationDate": 1732417111.357406,
    "hostOnly": false,
    "httpOnly": false,
    "name": "SEARCH_SAMESITE",
    "path": "/",
    "sameSite": "strict",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "CgQIn5sB",
    "id": 18
},
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.351278,
    "hostOnly": false,
    "httpOnly": false,
    "name": "SID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "g.a000mAjrg_tsgRAegxfz73becCejuuFF1e0BLs9DvFoykpTRah3SktKHWsZcqE0teO75lc5IjwACgYKAZ0SARMSFQHGX2MinN4qPsbO5Xfb4MopJxlQshoVAUF8yKoHPhbAeb2m4k5Bgy7gMsw10076",
    "id": 19
},
{
    "domain": ".youtube.com",
    "expirationDate": 1754616021.54718,
    "hostOnly": false,
    "httpOnly": false,
    "name": "SIDCC",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": false,
    "storeId": "0",
    "value": "AKEyXzW6RswuYxPpQzowVPCUykCMWQpOSsLbsVxAdmZOoyNva1RnzaxQ17O14adE-9WI6cjUfdU",
    "id": 20
},
{
    "domain": ".youtube.com",
    "expirationDate": 1756169387.351129,
    "hostOnly": false,
    "httpOnly": true,
    "name": "SSID",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "AeZJsmdC1gIK19T39",
    "id": 21
},
{
    "domain": ".youtube.com",
    "expirationDate": 1730268019.469594,
    "hostOnly": false,
    "httpOnly": true,
    "name": "VISITOR_PRIVACY_METADATA",
    "path": "/",
    "sameSite": "no_restriction",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "CgJVUxIEGgAgPQ%3D%3D",
    "id": 22
},
{
    "domain": ".youtube.com",
    "hostOnly": false,
    "httpOnly": false,
    "name": "wide",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": true,
    "storeId": "0",
    "value": "1",
    "id": 23
},
{
    "domain": ".youtube.com",
    "expirationDate": 1738631904,
    "hostOnly": false,
    "httpOnly": false,
    "name": "YT_CL",
    "path": "/",
    "sameSite": "unspecified",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "{\"loctok\":\"ACih6ZPTyQeduJA6lsOG4dNyNTdy9bMw0Ls-1SfCImI_jhuQ-sWH6qED61M5GNyu2BjWFQpFzpg774XTXv93NBT8k2rC3KFocUs\"}",
    "id": 24
}

  // Add additional cookies if needed
];

const agent = ytdl.createAgent(cookies);

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
    const botVoiceChannel = voiceChannel.guild.voiceStates.cache.get(message.client.user.id)?.channel;

    // Check if the bot is already in a voice channel
    if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
        return message.channel.send('I am already playing music in another channel. Please wait until the current music is finished.');
    }
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
            taskQueue.push(() => handleQueue(message.guild, queueContruct, song));
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
                taskQueue.push(() => handleQueue(message.guild, queueContruct, song));
            }
            message.channel.send(`${playlist.items.length} Song playlist added to the queue!`);
        } catch (err) {
            console.log('Error with YouTube playlist:', err);
            message.channel.send('Error retrieving YouTube playlist.');
        }
    } else {
        try {
            const songInfo = await ytdl.getInfo(searchString, { agent });
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                source: 'youtube'
            };
            taskQueue.push(() => handleQueue(message.guild, queueContruct, song));
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

async function handleQueue(guild, queueContruct, song) {
    const serverQueue = queue.get(guild.id);

    if (!serverQueue) {
        queue.set(guild.id, queueContruct);
        queueContruct.songs.push(song);
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
                queue.delete(guild.id);
                connection.destroy();
            }
        });
        play(guild, queueContruct.songs[0]);
    } else {
        serverQueue.songs.push(song);
        console.log(`${song.title} added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue) return message.channel.send('There is no song to skip!');

    serverQueue.songs.shift();
    if (serverQueue.songs.length === 0) {
        if (serverQueue.connection) serverQueue.connection.destroy();
        queue.delete(message.guild.id);
        message.channel.send('No more songs in the queue.');
    } else {
        play(message.guild, serverQueue.songs[0]);
    }
    message.channel.send(`Skipped to the next song. Now playing: **${serverQueue.songs[0].title}**`);
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue) return message.channel.send('There is no song to stop!');

    serverQueue.songs = [];
    if (serverQueue.connection) serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.channel.send('Playback stopped.');
}

function pause(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue || !serverQueue.player) return message.channel.send('There is no song playing to pause!');

    if (!serverQueue.paused) {
        serverQueue.player.pause(); // Pause the player
        serverQueue.paused = true;
        message.channel.send('Playback paused!');
    } else {
        message.channel.send('Playback is already paused!');
    }
}

function resume(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a voice channel!');
    if (!serverQueue || !serverQueue.player) return message.channel.send('There is no song playing to resume!');

    if (serverQueue.paused) {
        serverQueue.player.unpause(); // Resume the player
        serverQueue.paused = false;
        message.channel.send('Playback resumed!');
    } else {
        message.channel.send('Playback is already playing!');
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
            resource = createAudioResource(ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25, agent }));
        } else if (song.source === 'soundcloud') {
            resource = createAudioResource(song.url);
        }
    } catch (error) {
        console.error('Error creating audio resource:', error);
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guild, serverQueue.songs[0]);
        } else {
            serverQueue.connection.destroy();
            queue.delete(guild.id);
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
            play(guild, serverQueue.songs[0]);
        } else {
            serverQueue.connection.destroy();
            queue.delete(guild.id);
        }
    });

    player.on('error', (error) => console.error('Player Error:', error));
    
    serverQueue.textChannel.send(`Now playing: **${song.title}**`).then(() => {
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

        serverQueue.textChannel.send({
            content: 'Controls:',
            components: [row]
        });
    });
}

client.login(token);
