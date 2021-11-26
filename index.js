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

	} else if (message.content.startsWith(`${prefix}dit`)) {
		ass(message);
	} else if (message.content.startsWith(`${prefix}dui`)) {
		thighs(message);
	} else if (message.content.startsWith(`${prefix}chan`)) {
		feet(message);
	}else if (message.content.startsWith(`${prefix}lon`)) {
		pussy(message);
	}else if (message.content.startsWith(`${prefix}fate`)) {
		fate(message);
	}
	else if (message.content.startsWith(`${prefix}nach`)) {
		armpits(message);
	}
	else if (message.content.startsWith(`${prefix}gaicocu`)) {
		futa(message);
	}
	else if (message.content.startsWith(`${prefix}mecha`)) {
		mecha(message);
	}
	else if (message.content.startsWith(`${prefix}loli`)) {
		loli(message);
	}
	else if (message.content.startsWith(`${prefix}reddit`)) {
		reddit(message);
	}
	else if (message.content.startsWith(`${prefix}help`)) {
		message.channel.send('command nsfw is : lon, dit, dui, chan, fate')
	}

	else {
		message.channel.send('You need to enter a valid command!')
	}
});

async function execute(message, serverQueue) {
	const args = message.content.split(' ');
	var song = undefined;
	var search_string = args.toString().replace(/,/g,' ');
	
	let validate_playlist = ytpl.validateID(search_string);
	const voiceChannel = message.member.voiceChannel;
	if (!voiceChannel) return message.channel.send('��o trong k�nh');
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('I need the permissions to join and speak in your voice channel!');
	}
	if (!validate_playlist){
		var songInfo = await ytdl.getInfo(args[1]);
		song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
			};
	}
	else if (validate_playlist){
		var yt_playlist = await youtube.getPlaylist(search_string);
		for (var i = 0; i < yt_playlist.length; i++ ){
			var songInfoURL = await youtube.getVideo(yt_playlist[i].url);
			var args1 = songInfoURL.split(' ');
			var songInfo = await ytdl.getInfo(args1[1]);
			song = {
				title: songInfo.videoDetails.title,
				url: songInfo.videoDetails.video_url,
			};
		}
		
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
		console.log(serverQueue.songs);
		return message.channel.send(`${song.title} added to the queue!`);
	}

}

function skip(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('��o trong k�nh');
	if (!serverQueue) return message.channel.send('��o c� skip!');
	serverQueue.connection.dispatcher.end();
}
function reddit(message) {
	DabiClient.nsfw.real.hentai().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function ass(message) {
	DabiClient.nsfw.hentai.ass().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function loli(message) {
	DabiClient.nsfw.hentai.loli().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function mecha(message) {
	DabiClient.nsfw.hentai.mecha().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function futa(message) {
	DabiClient.nsfw.hentai.futa().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function armpits(message) {
	DabiClient.nsfw.hentai.armpits().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function thighs(message) {
	DabiClient.nsfw.hentai.thighs().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function feet(message) {
	DabiClient.nsfw.hentai.feet().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function fate(message) {
	DabiClient.nsfw.hentai.fate().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function pussy(message) {
	DabiClient.nsfw.hentai.pussy().then(json => {
		console.log(json);
    message.channel.send(`${json.url}`);

    // outputs data with image url, possible source and other stuff
}).catch(error => {
    console.log(error);
    // outputs error
	});


}
function stop(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('��o trong k�nh ko stop dc!');
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

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url,{filter: 'audioonly', quality: 'highestaudio',highWaterMark: 1<<25 },{highWaterMark: 1}))

		.on('end', () => {

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
