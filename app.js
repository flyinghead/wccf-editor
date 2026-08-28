const SERVER = 'http://localhost:17222';
const TEAM_URL = `${SERVER}/api/team`;
const IMAGE_URL = `${SERVER}/image/`;
const PITCH_XMIN = 30;
const PITCH_XMAX = 475;
const PITCH_W = PITCH_XMAX - PITCH_XMIN;
const PITCH_YMIN = 20;
const PITCH_YMAX = 580;
const PITCH_H = PITCH_YMAX - PITCH_YMIN;

let team = [];
let selected = null;
let lastSentAt = 0;
const SEND_THROTTLE_MS = 25;
let version = null;

const pitch = document.getElementById('pitch');
const info = document.getElementById('info');
const controls = document.getElementById('controls');
//const selPid = document.getElementById('sel-pid');
//const inputX = document.getElementById('input-x');
//const inputY = document.getElementById('input-y');
//const saveBtn = document.getElementById('save');
//const downloadBtn = document.getElementById('download');
const loadBtn = document.getElementById('load');
const randomBtn = document.getElementById('random');

function dataToPx(x,y)
{
    const rect = pitch.getBoundingClientRect();
    const scaleX = rect.width / PITCH_W;
    const scaleY = rect.height / PITCH_H;
    const px = (PITCH_W - x + PITCH_XMIN) * scaleX;
    const py = (PITCH_H - y + PITCH_YMIN) * scaleY;
    return {left: px, top: py};
}

function pxToData(px,py)
{
    const rect = pitch.getBoundingClientRect();
    const scaleX = rect.width / PITCH_W;
    const scaleY = rect.height / PITCH_H;
    const x = PITCH_W - (px / scaleX) + PITCH_XMIN;
    const y = PITCH_H - (py / scaleY) + PITCH_YMIN;
    return {x: Math.round(x), y: Math.round(y)};
}

function clearPlayers() {
    pitch.querySelectorAll('.player').forEach(n => n.remove());
    pitch.querySelectorAll('.player-caption').forEach(n => n.remove());
}

function render()
{
    clearPlayers();
    team.forEach(p => {
        if (p.pid === 0xffff)
            // skip empty slots
            return;
        // card element (rectangular)
        const el = document.createElement('div');
        el.className = 'player';
        el.dataset.pid = p.pid;
        // set player image as background
        const imgUrl = IMAGE_URL + p.pid + '.png';
        el.style.backgroundImage = `url(${imgUrl})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'left';
        el.style.backgroundRepeat = 'no-repeat';

        // caption below the card
        const caption = document.createElement('div');
        caption.className = 'player-caption';
        caption.dataset.pid = p.pid;
        caption.textContent = p.name || '';

        const pos = dataToPx(p.x, p.y);
        el.style.left = pos.left + 'px';
        el.style.top = pos.top + 'px';
        // caption positioned slightly below the card center
        caption.style.left = pos.left + 'px';
        caption.style.top = (pos.top + 44) + 'px';

        if (p.x < 130) {
            el.classList.add('bench');
            caption.classList.add('bench');
        }
        pitch.appendChild(el);
        pitch.appendChild(caption);

        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, { passive:false });
    });
}

async function sendPlayerUpdate(player)
{
    try {
        await fetch(TEAM_URL, {
            method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify([player])
        });
    } catch(e) {
        console.warn('Failed to send player update', e);
        info.textContent = 'Failed to send player update';
    }
}

function selectPlayer(pid)
{
    selected = team.find(t => t.pid == pid);
    if (!selected) {
        controls.hidden = true;
        info.textContent = 'No selection';
        return;
    }
    //selPid.textContent = selected.pid;
    //inputX.value = selected.x;
    //inputY.value = selected.y;
    controls.hidden = false;
    info.textContent = '';
}

function startDrag(e)
{
    e.preventDefault();
    const target = e.currentTarget;
    const pid = Number(target.dataset.pid);
    selectPlayer(pid);

    const move = (ev) => {
        const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const rect = pitch.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const d = pxToData(px,py);
        // clamp
        d.x = Math.max(0, Math.min(PITCH_XMAX, d.x));
        d.y = Math.max(0, Math.min(PITCH_YMAX, d.y));
        if (selected.x === d.x && selected.y === d.y)
            return;
        selected.x = d.x;
        selected.y = d.y;
        //inputX.value = selected.x;
        //inputY.value = selected.y;
        render();
        const now = Date.now();
        if (now - lastSentAt > SEND_THROTTLE_MS) {
            lastSentAt = now;
            sendPlayerUpdate(selected);
        }
    };

    const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        // ensure final update when drag ends
        if (selected)
            sendPlayerUpdate(selected);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('touchend', up);
}

/*
downloadBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(team,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wccf_team.json'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
*/

//saveBtn.addEventListener('click', save);
loadBtn.addEventListener('click', load);

randomBtn.addEventListener('click', async () => {
    if (!confirm('This will create a random team and overwrite the current one. Continue?'))
        return;
    console.log('Creating random team...');
    if (version === null) {
        try {
            const res = await fetch(SERVER + '/version');
            if (!res.ok)
                throw new Error('Failed to get game version');
            version = await res.text();
        } catch(err) {
            alert(err.message);
            return;
        }
    }
    let ranges, cardCount;
    switch (version) {
        case '116':
            cardCount = 462;
            ranges = [
                { start: 0x18, end: 0x83, special: 0 },
                { start: 0xc9, end: 0x1fe, special: 0 },
                { start: 0x226, end: 0x246, special: 0 },
                { start: 0x246, end: 0x254, special: 1 },
            ];
            break;
        case '212e':
        case '234j':
            cardCount = 340;
            ranges = [
                { start: 0x258, end: 0x378, special: 0 },
                { start: 0x378, end: 0x3ac, special: 1 },
            ];
            break;
        case '310j':
        case '322e':
        case '331e':
        case '331j':
        case '341j':
            cardCount = 352;
            ranges = [
                { start: 0x3ac, end: 0x3cc, special: 0 },
                { start: 0x3cc, end: 0x3fc, special: 1 },
                { start: 0x3fc, end: 0x400, special: 1 },
                { start: 0x44c, end: 0x52c, special: 0 },
                { start: 0x52c, end: 0x54c, special: 1 },
                { start: 0x54c, end: 0x558, special: 1 },
            ];
            break;
        case '400j':
        case '420e':
            cardCount = 389;
            ranges = [
                { start: 0x558, end: 0x559, special: 1 },
                { start: 0x579, end: 0x6c9, special: 0 },
                { start: 0x6c9, end: 0x6f3, special: 1 },
                { start: 0x6f3, end: 0x6fd, special: 1 },
            ];
            break;
        default:
            return;
    }
    const blacklistedCards = [ 0x4c0, 0x4c4, 0x4c6, 0x4ca, 0x4cc, 0x4ce, 0x4cf, 0x4d0, 0x642, 0x64b ];
    await deleteAllPlayers();
    team = [];
    for (let i = 0; i < 16; i++)
    {
        while (true) {
            const p = {
                pid: Math.floor(Math.random() * cardCount),
                x: (i % 4) * 100 + 40,
                y: Math.floor(i / 4) * 120 + 100
            };
            let count = 0;
            for (const r of ranges)
            {
                if (p.pid - count < r.end - r.start)
                {
                    p.pid = r.start + p.pid - count;
                    if (r.special)
                        p.pid |= 0x4000;
                    break;
                }
                count += r.end - r.start;
            }
            if (team.some(p2 => p2.pid === p.pid) || blacklistedCards.includes(p.pid))
                continue;
            team.push(p);
            break;
        }
    }
    await save();
    await load();
    render();
});

async function save()
{
    try {
        const res = await fetch(TEAM_URL, {
            method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(team)
        });
        if (!res.ok)
            throw new Error(await res.text());
    } catch(err) {
        alert('Save failed: '+err.message);
    }
}

async function load()
{
    try{
        const res = await fetch(TEAM_URL);
        if (!res.ok)
            throw new Error('Failed to load');
        team = await res.json();
        info.textContent = '';
        render();
    } catch(err) {
        info.textContent = 'Could not load team: ' + err.message
    }
}

async function deleteAllPlayers()
{
    try{
        const res = await fetch(TEAM_URL, { method: 'DELETE' });
        if (!res.ok)
            throw new Error('Failed to delete');
        info.textContent = '';
        render();
    } catch(err) {
        info.textContent = 'Could not delete players: ' + err.message
    }
}

async function deletePlayer(playerId)
{
    try{
        const res = await fetch(TEAM_URL + "/" + playerId, { method: 'DELETE' });
        if (!res.ok)
            throw new Error('Failed to delete');
        info.textContent = '';
        render();
    } catch(err) {
        info.textContent = 'Could not delete player: ' + err.message
    }
}

window.addEventListener('resize', render);
load();
