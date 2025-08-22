/************ Notes ************/
const notesList = document.getElementById('notesList');
const addNoteBtn = document.getElementById('addNote');
const clearNotesBtn = document.getElementById('clearNotes');
let draggingNote = null;

function autoResize(ta){
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function saveNotes(){
  const notes = Array.from(notesList.querySelectorAll('.note-text')).map(t=>t.value);
  localStorage.setItem('notes', JSON.stringify(notes));
}

function createNote(text=''){
  const row = document.createElement('div');
  row.className = 'note-row';

  const handle = document.createElement('span');
  handle.className = 'note-handle';
  handle.textContent = '\u2630';
  handle.setAttribute('draggable', 'true');

  const ta = document.createElement('textarea');
  ta.className = 'note-text';
  ta.value = text;
  autoResize(ta);

  const del = document.createElement('button');
  del.className = 'note-delete btn danger';
  del.textContent = '\u2715';

  handle.addEventListener('dragstart', (e)=>{
    draggingNote = row;
    row.classList.add('dragging');
    e.dataTransfer.setData('text/plain', '');
  });
  handle.addEventListener('dragend', ()=>{
    row.classList.remove('dragging');
    draggingNote = null;
    saveNotes();
  });
  ta.addEventListener('input', ()=>{ autoResize(ta); saveNotes(); });
  del.addEventListener('click', ()=>{ row.remove(); saveNotes(); });

  row.append(handle, ta, del);
  return row;
}

function addNote(text=''){
  const row = createNote(text);
  notesList.appendChild(row);
  saveNotes();
}

addNoteBtn.addEventListener('click', ()=> addNote());
clearNotesBtn.addEventListener('click', ()=>{
  notesList.innerHTML = '';
  localStorage.removeItem('notes');
});

notesList.addEventListener('dragover', (e)=>{
  e.preventDefault();
  if (!draggingNote) return;
  const after = getDragAfterElement(e.clientY);
  if (after == null) notesList.appendChild(draggingNote);
  else notesList.insertBefore(draggingNote, after);
});
notesList.addEventListener('drop', (e)=> e.preventDefault());

function getDragAfterElement(y){
  const els = [...notesList.querySelectorAll('.note-row:not(.dragging)')];
  return els.reduce((closest, child)=>{
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function loadNotes(){
  try {
    const data = JSON.parse(localStorage.getItem('notes') || '[]');
    data.forEach(t => addNote(t));
  } catch (e) { /* ignore */ }
}

loadNotes();
