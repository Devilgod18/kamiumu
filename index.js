﻿const Discord = require('discord.js');
const {
	prefix,
	
} = require('./config.json');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
const token = process.env.token;
const client = new Discord.Client();
const YouTube = require("discord-youtube-api");
const queue = new Map();
const DabiImages = require("dabi-images");
const DabiClient = new DabiImages.Client();
const request = require('request');
const cheerio = require('cheerio');
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);
const scdl = require('soundcloud-downloader').default;
client.once('ready', () => {
	console.log('Ready!');
});

client.once('reconnecting', () => {
	console.log('Reconnecting!');
});

client.once('disconnect', () => {
	console.log('Disconnect!');
});

client.on('message', async message => {
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

	} 

	else {
		message.channel.send('You need to enter a valid command!')
	}
});

async function execute(message, serverQueue) {
	const args = message.content.split(' ');
	const search_string = args.join(' ');
	let isPlaylist = ytpl.validateID(search_string);
	const voiceChannel = message.member.voice.channel;
	if (!voiceChannel) return message.channel.send('��o trong k�nh');
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('I need the permissions to join and speak in your voice channel!');
	}
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
  } else if (isPlaylist) {
    var yt_playlist = await youtube.getPlaylist(search_string);
    song = await youtube.getVideo(yt_playlist[0].url);
    song = {
      title: song.title,
      url: song.url,
      source: 'youtube'
    };
  } else {
    var songInfo = await ytdl.getInfo(args[1]);
    song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
      source: 'youtube'
    };
  }

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };
    queue.set(message.guild.id, queueContruct);
    queueContruct.songs.push(song);
    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    message.channel.send(`${song.title} added to the queue!`);
    return message.channel.send(`${serverQueue.songs.length} song(s) in queue!`);
  }
	
	
}

 
function skip(message, serverQueue) {
	if (!message.member.voice.channel) return message.channel.send('Ko trong k�nh');
	if (!serverQueue) return message.channel.send('Ko co skip!');
	if (serverQueue.songs[0].source === 'youtube') {
		serverQueue.connection.dispatcher.end();
	  } else if (serverQueue.songs[0].source === 'soundcloud') {
		if (serverQueue.scdispatcher) {
			serverQueue.scdispatcher.end();
		  } else {
			console.error('Dispatcher undefined for soundcloud song.');
		  }
		}
	message.channel.send(`${serverQueue.songs.length} Song in queue!`);
}

function stop(message, serverQueue) {
	if (!message.member.voice.channel) return message.channel.send('��o trong k�nh ko stop dc!');
	if (serverQueue.songs[0].source === 'youtube') {
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end();
	  } else if (serverQueue.songs[0].source === 'soundcloud') {
		serverQueue.songs = [];
		if (serverQueue.scdispatcher) {
			serverQueue.scdispatcher.end();
		  } else {
			console.error('Dispatcher undefined for soundcloud song.');
		  }
		}
	  message.channel.send('Queue has been stopped!');
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	let dispatcher;
	let scdispatcher;
  if (song.source === 'youtube') {
    dispatcher = serverQueue.connection
      .play(ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 }))
      .on('finish', () => {
        console.log('Music ended!');
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
      })
      .on('error', error => {
        console.error(error);
      });
  } else if (song.source === 'soundcloud') {
    dispatcher = serverQueue.connection
      .play(song.url, { highWaterMark: 1 << 25 })
      .on('finish', () => {
        console.log('Music ended!');
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
      })
      .on('error', error => {
        console.error(error);
      });
	  serverQueue.scdispatcher = dispatcher;
  }

  if (dispatcher) {
    serverQueue.dispatcher = dispatcher;
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  }
}

client.login(token);
