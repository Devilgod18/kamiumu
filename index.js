const Discord = require('discord.js');
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
	const queueContruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true,
		};
		if (args[1].includes('soundcloud.com')) {
			// Download SoundCloud track
			const trackInfo = await scdl.getInfo(args[1], process.env.SOUNDCLOUD_CLIENT_ID);
			const track = await scdl.downloadFormat(trackInfo.permalink_url, scdl.FORMATS.OPUS, process.env.SOUNDCLOUD_CLIENT_ID);
			let song = {
			  title: trackInfo.title,
			  url: track,
			};
			if (!serverQueue) {
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
		  } else if (isPlaylist) {
			const playlist = await ytpl(search_string);
			const videos = playlist.items;
			for (let i = 0; i < videos.length; i++) {
			  let song = {
				title: videos[i].title,
				url: videos[i].shortUrl
			  };
			  if (!serverQueue) {
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
				console.log(serverQueue.songs);
			  }
			}
			message.channel.send(`${videos.length} Song playlist added to the queue!`);
			return message.channel.send(`${serverQueue.songs.length} Song in queue!`);
		  } else {
			var songInfo = await ytdl.getInfo(args[1]);
			let song = {
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

	const dispatcher = serverQueue.connection.play(ytdl(song.url,{filter: 'audioonly', quality: 'highestaudio',typer:'opus',highWaterMark: 1<<25 },{highWaterMark: 1}))

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
