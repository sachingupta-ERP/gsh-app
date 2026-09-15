// Mock localStorage/saveKey/loadKey
let _store = {};
global.saveKey = (k, v) => _store[k] = v;
global.loadKey = (k, def) => _store[k] || def;
global.toast = console.log;
global.escapeHtml = s => s;

global.BUSINESS_DATE = "2026-09-13";

// NOTE PAD LOGIC
let currentNotePadDate = BUSINESS_DATE;
let NOTE_PAD_DATA = loadKey('gsh:notepad', {});

function addDaysToDateStr(dtStr, days) {
  const d = new Date(dtStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function showCarryForwardPrompt(pendingItemsMap) {
  window.pendingCarryForwardData = pendingItemsMap;
}

function skipCarryForward() {
  window.pendingCarryForwardData = null;
}

function confirmCarryForward() {
  const itemsMap = window.pendingCarryForwardData;
  if(!itemsMap) return skipCarryForward();
  
  if(!NOTE_PAD_DATA[currentNotePadDate]) NOTE_PAD_DATA[currentNotePadDate] = [];
  
  Object.keys(itemsMap).forEach(oldDate => {
    itemsMap[oldDate].forEach(item => {
      const oldItem = NOTE_PAD_DATA[oldDate].find(i => i.id === item.id);
      if(oldItem) {
        oldItem.status = 'CARRIED_FORWARD';
        oldItem.carriedTo = currentNotePadDate;
      }
      
      NOTE_PAD_DATA[currentNotePadDate].push({
        id: 'np_' + Date.now() + Math.random(),
        text: item.text,
        vendor: item.vendor,
        status: 'PENDING',
        createdOn: item.createdOn || oldDate,
        isCarryForward: true
      });
    });
  });
  
  saveKey('gsh:notepad', NOTE_PAD_DATA);
  toast('✓ Pending items successfully carried forward.');
  skipCarryForward();
}

function checkPendingCarryForward() {
  const allDates = Object.keys(NOTE_PAD_DATA).sort();
  let pendingMap = {};
  let hasPending = false;
  
  for(let dt of allDates) {
    if (dt >= currentNotePadDate) break;
    let pendingOnDate = NOTE_PAD_DATA[dt].filter(i => i.status === 'PENDING');
    if (pendingOnDate.length > 0) {
      pendingMap[dt] = pendingOnDate;
      hasPending = true;
    }
  }
  
  if(hasPending) {
    showCarryForwardPrompt(pendingMap);
  }
}

function renderNotePad() {
  checkPendingCarryForward();
}

function toggleNotePadItem(id) {
  if(!NOTE_PAD_DATA[currentNotePadDate]) return;
  const item = NOTE_PAD_DATA[currentNotePadDate].find(i => i.id === id);
  if(!item) return;
  
  if(item.status === 'PENDING') {
    item.status = 'RECEIVED';
  } else if (item.status === 'RECEIVED') {
    item.status = 'PENDING';
  }
  saveKey('gsh:notepad', NOTE_PAD_DATA);
}

function updateNotePadItem(id, field, val) {
  if(!NOTE_PAD_DATA[currentNotePadDate]) NOTE_PAD_DATA[currentNotePadDate] = [];
  
  if (id === 'new') {
    if (!val.trim()) return;
    NOTE_PAD_DATA[currentNotePadDate].push({
      id: 'np_' + Date.now() + Math.random(),
      text: field === 'text' ? val : '',
      vendor: field === 'vendor' ? val : '',
      status: 'PENDING',
      createdOn: currentNotePadDate,
      isCarryForward: false
    });
    saveKey('gsh:notepad', NOTE_PAD_DATA);
    return NOTE_PAD_DATA[currentNotePadDate][NOTE_PAD_DATA[currentNotePadDate].length - 1].id;
  }
  
  const item = NOTE_PAD_DATA[currentNotePadDate].find(i => i.id === id);
  if(!item) return;
  item[field] = val;
  saveKey('gsh:notepad', NOTE_PAD_DATA);
}

function changeNotePadDay(dir) {
  currentNotePadDate = addDaysToDateStr(currentNotePadDate, dir);
  renderNotePad();
}

// TEST SCRIPT
let id1 = updateNotePadItem('new', 'text', "5 Laser");
updateNotePadItem(id1, 'vendor', "Agarwal");

let id2 = updateNotePadItem('new', 'text', "10 Kit");
updateNotePadItem(id2, 'vendor', "Jaharveer");

let id3 = updateNotePadItem('new', 'text', "1 Table");
updateNotePadItem(id3, 'vendor', "Jaharveer");

// Mark 5 Laser Received
toggleNotePadItem(id1);

console.log("Day 1 state:");
console.log(JSON.stringify(NOTE_PAD_DATA['2026-09-13'].map(i => i.text + " = " + i.status)));

// Day 2
changeNotePadDay(1);
confirmCarryForward(); // OK carry forward

let id4 = updateNotePadItem('new', 'text', "20 Notebook");
updateNotePadItem(id4, 'vendor', "Agarwal");

// Mark 10 Kit received (it's the first carried forward item)
toggleNotePadItem(NOTE_PAD_DATA['2026-09-14'][0].id);

console.log("Day 1 state after CF:");
console.log(JSON.stringify(NOTE_PAD_DATA['2026-09-13'].map(i => i.text + " = " + i.status)));

console.log("Day 2 state:");
console.log(JSON.stringify(NOTE_PAD_DATA['2026-09-14'].map(i => i.text + " = " + i.status)));

// Day 3
changeNotePadDay(1);
confirmCarryForward();

console.log("Day 3 state:");
console.log(JSON.stringify(NOTE_PAD_DATA['2026-09-15'].map(i => i.text + " = " + i.status)));
