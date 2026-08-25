const TEAM_URL = 'http://localhost:17222/api/team';
const IMAGE_URL = 'http://localhost:17222/image/';
const PITCH_W = 390;
const PITCH_H = 540;

let team = [];
let selected = null;
let lastSentAt = 0;
const SEND_THROTTLE_MS = 50;
let curDelta = 1;
let timeoutId = null;

const pitch = document.getElementById('pitch');
const info = document.getElementById('info');
const controls = document.getElementById('controls');
//const selPid = document.getElementById('sel-pid');
//const inputX = document.getElementById('input-x');
//const inputY = document.getElementById('input-y');
//const applyBtn = document.getElementById('apply');
const saveBtn = document.getElementById('save');
//const downloadBtn = document.getElementById('download');
const loadBtn = document.getElementById('load');
const randomBtn = document.getElementById('random');

function dataToPx(x,y)
{
    const rect = pitch.getBoundingClientRect();
    const scaleX = rect.width / PITCH_W;
    const scaleY = rect.height / PITCH_H;
    const px = (PITCH_W - x) * scaleX;
    const py = (PITCH_H - y) * scaleY;
    return {left: px, top: py};
}

function pxToData(px,py)
{
    const rect = pitch.getBoundingClientRect();
    const scaleX = rect.width / PITCH_W;
    const scaleY = rect.height / PITCH_H;
    const x = PITCH_W - (px / scaleX);
    const y = PITCH_H - (py / scaleY);
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

        if (p.x < 64)
            el.classList.add('bench');
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
        d.x = Math.max(0, Math.min(PITCH_W, d.x));
        d.y = Math.max(0, Math.min(PITCH_H, d.y));
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

    const dblclick = () => {
        if (selected.delta !== undefined && selected.delta !== 0)
            return;
        info.textContent = 'Player ' + selected.pid + ' rubbed. Delta ' + curDelta;
        selected.delta = curDelta;
        sendPlayerUpdate(selected);
        timeoutId = setTimeout(() => {
            info.textContent = '';
            selected.delta = 0;
            curDelta++;
            sendPlayerUpdate(selected);
            cancelTimeout(timeoutId);
            timeoutId = null;
        }, 2000);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('touchend', up);
    window.addEventListener('dblclick', dblclick);
}

/*
applyBtn.addEventListener('click', () => {
  if(!selected) return;
  selected.x = Number(inputX.value);
  selected.y = Number(inputY.value);
  render();
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(team,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wccf_team.json'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
*/

saveBtn.addEventListener('click', save);
loadBtn.addEventListener('click', load);

randomBtn.addEventListener('click', async () => {
    if (!confirm('This will create a random team and overwrite the current one. Continue?'))
        return;
    console.log('Creating random team...');
    await deleteAllPlayers();
    team = [];
    for (let i = 0; i < 16; i++)
    {
        while (true) {
            const p = {
                pid: Math.floor(Math.random() * 388) + 1401,
                x: (i % 4) * 100 + 40,
                y: Math.floor(i / 4) * 120 + 100
            };
            if (p.pid >= 1737)
                p.pid |= 0x4000;
            if (team.some(p2 => p2.pid === p.pid))
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
        //alert('Saved successfully');
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
