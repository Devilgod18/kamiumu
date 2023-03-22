const Discord = require('discord.js');
const {
	prefix,
	
} = require('./config.json');
const scdl = require('soundcloud-downloader').default;
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
	var search_string = args.toString().replace(/,/g,' ');
	let validate_playlist = ytpl.validateID(search_string);
	const voiceChannel = message.member.voice.channel;
	if (!voiceChannel) return message.channel.send('��o trong k�nh');
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('I need the permissions to join and speak in your voice channel!');
	}
	let songInfo;
    let song;
	const queueContruct = {
		textChannel: message.channel,
		voiceChannel: voiceChannel,
		connection: null,
		songs: [],
		volume: 5,
		playing: true,
	};
	
    if (args[1].startsWith('https://soundcloud.com/')) {
      const trackInfo = await scdl.getInfo(args[1]);
      song = {
        title: trackInfo.title,
        url: trackInfo.permalink_url
      };
	  if (!serverQueue) {
		queue.set(message.guild.id, queueContruct);
		queueContruct.songs.push(song);
		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
			play(message.guild, queueContruct.songs[0]);
			console.log(queueContruct.songs);
			
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		message.channel.send(`${song.title} added to the queue!`);
		return message.channel.send(`${serverQueue.songs.length} Song in queue!`);
	}
	
	}
	else if (!validate_playlist){
		songInfo = await ytdl.getInfo(args[1]);
		song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url
			};
			
		if (!serverQueue) {
		queue.set(message.guild.id, queueContruct);
		queueContruct.songs.push(song);
		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
			play(message.guild, queueContruct.songs[0]);
			console.log(queueContruct.songs);
			
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		message.channel.send(`${song.title} added to the queue!`);
		return message.channel.send(`${serverQueue.songs.length} Song in queue!`);
	}
	}
	else if (validate_playlist){
		if(!serverQueue){
		var yt_playlist = await youtube.getPlaylist(search_string);
		songInfo = await youtube.getVideo(yt_playlist[0].url);
		song = {
				title: songInfo.title,
				url: songInfo.url
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
		
		for (var i = 1;i < yt_playlist.length;i++) {
			songInfo = await youtube.getVideo(yt_playlist[i].url);
			song = {
				title: songInfo.title,
				url: songInfo.url
				};
			queueContruct.songs.push(song);
			
			
					
		}
		
		console.log(queueContruct.songs);
		console.log(queueContruct.songs.length);
		
		message.channel.send(`${yt_playlist.length} Song playlist added to the queue!`);
		return message.channel.send(`${queueContruct.songs.length} Song in queue!`);
		}
		
		else{
			var yt_playlist = await youtube.getPlaylist(search_string);
		    for (var i = 0;i < yt_playlist.length;i++) {
			songInfo = await youtube.getVideo(yt_playlist[i].url);
			song = {
				title: songInfo.title,
				url: songInfo.url
				};
			serverQueue.songs.push(song);
			console.log(serverQueue.songs);
			}
			message.channel.send(`${yt_playlist.length} Song playlist added to the queue!`)
			return message.channel.send(`${serverQueue.songs.length} Song in queue!`);
		}
	}
	
	
}

 
function skip(message, serverQueue) {
	if (!message.member.voice.channel) return message.channel.send('Ko trong k�nh');
	if (!serverQueue) return message.channel.send('Ko co skip!');
	serverQueue.connection.dispatcher.end();
	message.channel.send(`${serverQueue.songs.length} Song in queue!`);
}

function stop(message, serverQueue) {
	if (!message.member.voice.channel) return message.channel.send('��o trong k�nh ko stop dc!');
	serverQueue.songs = [];
	serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection.play(ytdl(song.url,{filter: 'audioonly', quality: 'highestaudio',highWaterMark: 1<<25 },{highWaterMark: 1}))

		.on("finish", () => {

			console.log('Music ended!');

			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
			highWaterMark: 1<<25
		})
		.on('error', error => {
			console.error(error);
		});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(token);
