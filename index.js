const cheerio = require("cheerio");
const axios = require("axios");
const { LambdaClient, UpdateFunctionConfigurationCommand } = require("@aws-sdk/client-lambda");

// Mcwf9Ia47w57 EDy6DmqZGJEUfjdNl92 Lu0ly ghp

const selectRandomUserAgent = () => {
    const userAgents = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"]
    const randomNumber = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomNumber];
}

const restart_server = () => {
	const lambda = new LambdaClient({region: 'eu-west-3', accessKeyId: process.env.USER_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.USER_AWS_SECRET_ACCESS_KEY});
	const command = new UpdateFunctionConfigurationCommand({
	  FunctionName: 'scrapr',
	  Environment: {
		Variables: {
		  'USER_AWS_ACCESS_KEY_ID': process.env.USER_AWS_ACCESS_KEY_ID,
		  'USER_AWS_SECRET_ACCESS_KEY': process.env.USER_AWS_SECRET_ACCESS_KEY,
		  'RESTART_TIME': Date.now().toString()
		}
	  }
	});
	lambda.send(command);
	return {
		statusCode: 429
	};	
}

const googleserp_scraper = async(lang, country, term, start) => {
	
	if(term=='restart' && start==429)
		throw new Error('Recaptcha');

	let url = 'https://www.google.com/search?hl='+lang+'&gl='+country+'&start='+start+'&q='+term;
	return axios.get(url, {
		headers: {
			"Referer": "https://www.google.com",
			"User-Agent": selectRandomUserAgent()
		}
	})
	.then((response) => {
		let $ = cheerio.load(response.data);

		let results = [];
		
		if($(".g-recaptcha").length) {
			throw new Error('Recaptcha');
		}
		
		$("a[href]:has(h3)").each((i,el) => {			
			if($(el).attr('href').startsWith('/') === false) {
				results.push({
					url: $(el).attr('href'),
					title: $(el).find('h3').first().text()
				})
			}
		})
		
		return results;
	});
	
}

const analysis_scraper = async(url) => {
	const tagslist = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'li', 'p', 'div', 'main', 'section', 'header', 'footer'];
	const html = await axios.get(url, {
		headers: {
			"Referer": "https://www.google.com",
			"User-Agent": selectRandomUserAgent()
		}
	}).then((response) => { return response.data; });
	const stopwords = await axios.get('https://raw.githubusercontent.com/Alir3z4/stop-words/master/french.txt').then((response) => { return response.data.split(/\r?\n|\r|\n/g); });
	const $ = cheerio.load(html);
	const lines = [];
	$(tagslist.join(':not(:has('+tagslist.join(',')+')), ')+':not(:has('+tagslist.join(',')+'))').each((i,el) => {
		let txt = $(el).text().split(/\r?\n|\r|\n|\.|\:|\;\!\?/g).filter(e=>e.trim())
		for(const t of txt) {
			const keywords = t.replace(/[\.\:\;\!\?]/g, '').replace(/[^\s\'\u20190-9A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02af\u1d00-\u1d25\u1d62-\u1d65\u1d6b-\u1d77\u1d79-\u1d9a\u1e00-\u1eff\u2090-\u2094\u2184-\u2184\u2488-\u2490\u271d-\u271d\u2c60-\u2c7c\u2c7e-\u2c7f\ua722-\ua76f\ua771-\ua787\ua78b-\ua78c\ua7fb-\ua7ff\ufb00-\ufb06]/g, '').toLowerCase().trim().split(/[\'\u2019]|\s+/).filter(w => !stopwords.includes(w.toLowerCase()))
			lines.push({
				type: (el.type=='tag' ? el.name : 'text'),
				keywords: keywords
			})
		}
	})
	return lines;	
}

const default_handler = async () => {
	return {
		statusCode: 200,
		body: JSON.stringify({_rt: process.env.RESTART_TIME})
	};	
}

const googleserp_handler = async (locale, term, start) => {
	try {
		const locale_split = locale.trim().toLowerCase().split('-');
		const lang = typeof locale_split[0] !== "undefined" ? locale_split[0] : 'fr';
		const country = typeof locale_split[1] !== "undefined" ? locale_split[1] : lang;
		const scraper_data = await googleserp_scraper(lang, country, term, start);
		return {
			statusCode: 200,
			body: JSON.stringify({results: scraper_data})
		};
	} catch(error) {
		console.log(error);
		if(error.message == 'Recaptcha')
			return restart_server();
		else
			return { statusCode: 404 };	
	}	
}

const analysis_handler = async (url) => {
	try {
		const scraper_data = await analysis_scraper(decodeURIComponent(url));
		return {
			statusCode: 200,
			body: JSON.stringify({results: scraper_data})
		};
	} catch(error) {
		console.log(error);
		if(error.message == 'Recaptcha')
			return restart_server();
		else
			return { statusCode: 404 };	
	}
}

exports.handler = async (event) => {
	if(event.resource == '/google-serp/{locale}/{term}/{start}' && event.pathParameters && typeof event.pathParameters.locale !== "undefined" && typeof event.pathParameters.term !== "undefined" && typeof event.pathParameters.start !== "undefined")
		return googleserp_handler(event.pathParameters.locale, event.pathParameters.term, event.pathParameters.start);
	if(event.resource == '/analysis/{url}' && event.pathParameters && typeof event.pathParameters.url !== "undefined")
		return analysis_handler(event.pathParameters.url);
	return default_handler();
}