const yaml = require('js-yaml');
const Telegram = require('telegraf/telegram');
const fs = require('fs');
const PA = require('https-proxy-agent');
const Utimes = require('@ronomon/utimes');
const util = require('util');

const utimes = util.promisify(Utimes.utimes);

let stat;
try {
  stat = require('./stat.json');
} catch {
  stat = {};
}

const dir = fs.readdirSync('desc');
const channel = process.env.CHANNEL;
if(!channel) {
  console.error('No CHANNEL specified');
  process.exit(1);
}

if(!process.env.BOT_TOKEN) {
  console.error('No BOT_TOKEN specified');
  process.exit(1);
}

const opts = {};
if(process.env.PROXY)
  opts.agent = new PA(process.env.PROXY);
const bot = new Telegram(process.env.BOT_TOKEN, opts);

function serializeMsg(content) {
  let text = `*${content.title}*\n` +
    `${content.titleCN}\n` +
    `\n` +
    `作者: *${content.author}*\n` +
    (content.illust ? `插画: *${content.illust}*\n` : '') +
    `\n` +
    `Bangumi: [${content.bgm}](https://bgm.tv/subject/${content.bgm})\n`;

  content.vols.forEach((e, i) => {
    const name = e.subtitle ? `vol ${i+1}: *${e.subtitle}*` : `*vol ${i+1}*`;
    let current = `${name}\n`;
    if(e.bgm)
      current += `Bangumi: [${e.bgm}](https://bgm.tv/subject/${e.bgm})\n`;
    if(e.read)
      current += `Read: [${e.read}](${e.read})\n`;

    if(e.dwn) {
      if(e.dwn.epub)
        current += `ePub: [${e.dwn.epub}](${e.dwn.epub})\n`;
      if(e.dwn.txt)
        current += `txt: [${e.dwn.txt}](${e.dwn.txt})\n`;
    }

    text += '\n' + current;
  });

  return text;
}

async function sendMsg(channel, content) {
  const msg = serializeMsg(content);
  const sent = await bot.sendMessage(channel, msg, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
  return sent.message_id;
}

const forceUpdate = process.env.FORCE_UPDATE === 'true';

async function editMsg(channel, tgid, content) {
  const msg = serializeMsg(content);
  try {
    await bot.editMessageText(channel, tgid, null, msg, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    return true;
  } catch(e) {
    if(forceUpdate)
      return true;
    return false;
  }
}

async function work() {
  const reverseMap = {};

  for(const e of dir) {
    const fstat = fs.statSync(`desc/${e}`);
    const name = e.split('.yml').join('');
    const content = yaml.load(fs.readFileSync(`desc/${e}`).toString('utf-8'));
    let mtime = fstat.mtime.toISOString();

    // Add to reverse mapping
    if(content.bgm) {
      reverseMap[content.bgm] = {
        series: content.title,
        index: -1, // Series
      };

      content.vols.forEach((vol, i) => {
        if(vol.bgm) reverseMap[vol.bgm] = {
          series: content.title,
          index: i,
        };
      });
    }

    if(!forceUpdate && stat[name] && stat[name].mtime === mtime) {
      console.log('Unchanged, continue');
      continue;
    }

    let tgid = '';

    if(!stat[name])
      tgid = await sendMsg(channel, content);
    else {
      tgid = stat[name].tgid;
      const updated = await editMsg(channel, tgid, content);
      if(!updated) {
        console.log('Mtime differs but content unchanged, restoring mtime');

        let originalMtime = new Date(stat[name].mtime).getTime();
        await utimes(`desc/${e}`, undefined, originalMtime, undefined);
        continue;
      }
    }

    stat[name] = {
      mtime,
      tgid,
    };
  }

  fs.writeFileSync('./stat.json', JSON.stringify(stat));
  fs.writeFileSync('./revMap.json', JSON.stringify(reverseMap));
}

work();
