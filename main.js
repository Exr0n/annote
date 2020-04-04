'use strict';

var global_andoc;

const config = {
    keyTimeout: 1000,
    scrollSpeed: 100,
    notebox: {
        width: 400,
        height: 400,
        shiftSpeed: 10
    }
};

class KeyHandler { // TODO: only supports chords, no hotkeys
    constructor(element, keybinds, activityChecker, delay) {
        this.delay = delay || 100; // ms
        this.keybinds = keybinds;
        this.activityChecker = activityChecker; // boolean supplier that decides whether to honor key events
        this.buffer = ['']; // history of commands
        this.down = []; // currently depressed keys
        this.listeners = {'change': []}; // event listeners
        this.timeout; // abort any inputted keys after this many milliseconds

        // register key listeners
        element.addEventListener('keydown', this.handleDown.bind(this));
        element.addEventListener('keyup', this.handleUp.bind(this));
    }
    async handleDown(ev) {
        if (!this.activityChecker()) return this.abort();
        if (this.buffer[this.buffer.length-1].length === 0) { // if no previous key sequence
            if (await this.attemptKeys(ev.key)) { // try a single key repeating command
                return;
            } else if (ev.key.length > 1) { // special key
                this.emit('special', ev.key); // emit for outer handling
            }
        }
        if (ev.key.length === 1) { // if it's a normal key
            if (!this.down.includes(ev.key)) {
                this.down.push(ev.key);
            }
        }
    }
    async handleUp(ev) {
        // check whether keyhandler should be active
        if (!this.activityChecker()) return this.abort();
        // reset inactivity timeout
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.abort.bind(this), this.delay);

        if (ev.key.length === 1) { // if it was a normal key
            let key = this.down.shift(); // get released key
            if (key !== ev.key) { // key released in different order from pressing... abort this chord
                this.abort();
                return;
            }
            this.buffer[this.buffer.length-1] += key; // transfer released key to buffer

            this.emit('change', {keys: this.buffer[this.buffer.length-1], new: key}); // callback to update dom

            // check if the current sequence triggers any commands
            let command = this.buffer[this.buffer.length-1];
            if (await this.attemptKeys(command)) { // if this command went through
                // "soft" abort
                clearTimeout(this.timeout); // clear abort timeout
                this.buffer.push(this.buffer[this.buffer.length-1].slice(command.length)); // push the current key buffer (after slicing off successful command)
                this.emit('change', {keys: this.buffer[this.buffer.length-1]});
            }
        }
    }
    async attemptKeys(command, keybinds) {
        keybinds = keybinds || this.keybinds; // use global keybinds if none were specified
        for (let [regex, next] of keybinds) { // for each possible command
            let matched = command.match(regex);
            if (matched !== null) { // if command matches
                if (typeof next === 'function') if (next(command)) return true; // if it's a command, run it
                else if (next instanceof Map) if (await attemptKeys(command, next)) return true; // TODO: untested
            }
        }
        return false; // nothing matched
    }
    abort() {
        clearTimeout(this.timeout); // clear any abort timeouts
        this.buffer.push(''); // reset active key sequence
        this.emit('change', {keys: this.buffer[this.buffer.length-1]}); // emit event to update dom
    }
    async on(name, call) {
        if (!this.listeners.hasOwnProperty(name)) // nothing registered yet
            this.listeners[name] = []; // initialize so we can push directly
        this.listeners[name].push(call); // add the callback
    }
    async emit(name, data) {
        if (!this.listeners.hasOwnProperty(name)) return; // this event doesn't have any callbacks
        // call each callback with the data
        for (let call of this.listeners[name])
            call(data);
    }
}

class AnDoc {
    constructor(rootElement) {
        this.root = rootElement; // should be `document`
        this.notes = new Map(); // all notes in this andoc
        this.focused = undefined; // currently focused note
        this.editing = undefined; // note that is currently being edited

        this.mdConverter = new showdown.Converter({ // markdown converter to be used by noteboxes
            ghCompatibleHeaderId: true,
            parseImgDimensions: true,
            simplifiedAutoLink: true,
            strikethrough: true,
            tables: true,
            ghCodeBlocks: true,
            tasklists: true,
            ghMentions: false,
            smartIndentationFix: true,
            disableForced4SpacesIndentedSublists: true
            // TODO: katex extension + custom anchor
        });

        this.idGenerator = (function *() {
            var letters = 'abcdefghijklmnopqrstuvwxyz';
            const increment = (str, idx) => { // increment the letter at `idx` in `str`
                let newChar = String.fromCharCode((str.charCodeAt(id.length+idx)-97 +1)%26+97);
                return str.slice(0, id.length+idx) + newChar + str.slice(id.length+idx+1);
            }
            var id = 'a';
            while (true) {
                yield id;
                // shift id: a, b, ..., z, aa, ab, ...
                let idx = 0;
                do { // decrement each index in turn, with carrying
                    --idx; // next index to decrement
                    if (-idx-1 == id.length) { // if at the end of the string
                        id = 'a' + id; // start over with one more `a` ("aaa" -> "aaaa")
                        break;
                    }
                    id = increment(id, idx); // increment the letter we should increment
                } while (id[id.length+idx] == letters[0]) // do the next one if the one we just incremented was 'a', aka carry
            }
        })();

        this.dom = { // get dom elements for displaying messages in the bottom right
            messages: document.getElementById('messages-wrapper'),
            keyChord: document.getElementById('keypress-display')
        }

        // create keyhandler
        this.keyHandler = new KeyHandler(
            document, // element to listen on
            AnDoc.keybinds(this, window), // keybinds
            this.keyboardActivityChecker.bind(this), // activity checker -- returns whether to honor keybinds
            config.keyTimeout // key timeout
        );
        this.keyHandler.on('change', (evt) => { // event listener--update key display
            this.dom.keyChord.innerHTML = evt.keys;
        });
        this.keyHandler.on('special', this.specialKey.bind(this)); // handle special keys (meta, enter, etc); TODO: jank

        // Initialize UX
        this.main = new Notebox(this, 0, 0); // create root notebox
        this.focus(this.main); // focus it
    }
    keyboardActivityChecker() {
        return typeof this.editing === 'undefined'; // listen for keys if not currently in a codemirror
    }
    async specialKey(key) {
        switch (key) {
            case "Enter":
                if (typeof this.focused !== 'undefined') { // if focused
                    this.edit(this.focused); // edit that notebox
                }
                break;
        }
    }
    assignId() {
        // TODO: swappable id's; fill in gaps from deleted notes; id's based on tree structure? (parent/child)
        return this.idGenerator.next().value; // get the next ID from generator
    }
    async focus(note) {
        if (this.focused === note) return;
        if (typeof this.focused !== 'undefined')
            this.focused.blur(); // blur previous focused note
        this.focused = note; // update internal state
        note.focus(); // focus the note (UX)
    }
    async edit(note) {
        if (typeof this.editing !== 'undefined') // if editing something
            this.editing.render(); // stop editing it
        this.editing = note; // update internal state
        this.focus(note); // update focus on UX
        note.edit(); // have note show codemirror, etc
    }
    async unedit() { // stop editing all notes
        if (typeof this.editing === 'undefined') return;
        this.editing.render(); // render the note that's currently being edited
        this.focus(this.editing); // focus the rendered note
        this.editing = undefined; // update internal state
    }
    async createNote(root, x, y, w, h, content) {
        root = root || this.root; // root of the note, either passed or the root note
        let note = new Notebox(root, x, y, w, h, content); // construct the new note
        this.notes.set(note.id, note); // register theh note (update internal state)
        this.focus(note); // focus the new note
        return note;
    }
    async deleteNote(note) {
        if (note.root instanceof AnDoc) // disallow deleting the bottom-most note
            throw new Error("Cannot delete root node!");
        note.root.removeChild(note); // remove this note as a child of its parent
        this.notes.delete(note.id); // unregister note from internal state
        this.focus(note.root); // focus the root of the deleted note
        return true;
    }
    appendChild(note) {
        this.root.appendChild(note.dom.wrapper);
    }
}
AnDoc.keybinds = (doc, win) => {
    var ret = new Map();
    ret.set('^f', (cmd) => {
        cmd = prompt("What note would you like to focus?");
        if (doc.notes.has(cmd)) {
            doc.focus(doc.notes.get(cmd));
            doc.notes.get(cmd).dom.wrapper.scrollIntoView();
            return true;
        } else {
            return false;
        }
    });
    // vim movement
    (() => {
        ret.set('^h$', (cmd) => {
            win.scrollBy(-config.scrollSpeed, 0);
            return true;
        });
        ret.set('^l$', (cmd) => {
            win.scrollBy(config.scrollSpeed, 0);
            return true;
        });
        ret.set('^j$', (cmd) => {
            win.scrollBy(0, config.scrollSpeed);
            return true;
        });
        ret.set('^k$', (cmd) => {
            win.scrollBy(0, -config.scrollSpeed);
            return true;
        });
    })();
    // modify notes
    (() => {
        ret.set('^o$', (cmd) => {
            doc.createNote(doc.focused, doc.focused.x, doc.focused.y, config.notebox.width, config.notebox.height);
            return true;
        });
        ret.set('^H$', (cmd) => {
            if (doc.focused.x < config.notebox.shiftSpeed) return true;
            doc.focused.x -= config.notebox.shiftSpeed;
            doc.focused.render();
            return true;
        });
        ret.set('^L$', (cmd) => {
            doc.focused.x += config.notebox.shiftSpeed;
            doc.focused.render();
            return true;
        });
        ret.set('^K$', (cmd) => {
            if (doc.focused.y < config.notebox.shiftSpeed) return true;
            doc.focused.y -= config.notebox.shiftSpeed;
            doc.focused.render();
            return true;
        });
        ret.set('^J$', (cmd) => {
            doc.focused.y += config.notebox.shiftSpeed;
            doc.focused.render();
            return true;
        });
        ret.set('^dd$', (cmd) => {
            if (doc.focused.root instanceof AnDoc) return false;
            doc.deleteNote(doc.focused);
            return true;
        });
    })();
    console.log(ret);
    return ret;
};
AnDoc.codeMirrorOpts = {
    lineNumbers: true,
    mode: "markdown",
    theme: "ayu-dark",
    keyMap: "vim",
    indentUnit: 4,
    showCursorWhenSelecting: true
}

class Notebox {
    constructor(root, x, y, w, h, contents) {
        this.root = root;
        this.x = x || 0;
        this.y = y || 0;
        this.w = w || document.body.clientWidth;
        this.h = h;

        this.children = new Map();
        this.mode = 0; // 0 = disp, 1 = edit

        if (root instanceof AnDoc) this.andoc = root;
        else this.andoc = root.andoc
        this.id = this.andoc.assignId();

        this.contents = contents  || `<a name=notebox-${this.id}></a>\n`;

        // update DOM
        (() => {
            this.dom = {};
            this.dom.wrapper = document.createElement("div");
            this.dom.wrapper.setAttribute('id', this.id);
            this.dom.wrapper.setAttribute('class', 'float-wrap');
            this.dom.wrapper.style.left = this.x + 'px';
            this.dom.wrapper.style.top = this.y + 'px';
            this.dom.wrapper.style.width = this.w + 'px';
            this.dom.wrapper.style.zIndex = 0;
            if (this.h) this.dom.wrapper.style.height = this.h + 'px';

            this.dom.display = document.createElement("div");
            this.dom.display.setAttribute('class', 'float-disp');
            this.dom.display.innerHTML = this.andoc.mdConverter.makeHtml(this.contents);
            this.dom.wrapper.appendChild(this.dom.display);

            this.dom.info = document.createElement("div");
            this.dom.info.setAttribute('class', 'float-info');
            this.dom.info.innerHTML = `${this.id}`;
            this.dom.wrapper.appendChild(this.dom.info);

            this.cmEditor = CodeMirror((cm) => {
                this.dom.wrapper.appendChild(cm); // construct codemirror
            }, AnDoc.codeMirrorOpts);
            this.cmEditor.getWrapperElement().style.display = "none";
            this.cmEditor.getWrapperElement().style.zIndex = 1000;

            this.dom.wrapper.addEventListener('click', (e) => {
                e.stopPropagation(); // https://stackoverflow.com/a/10554459
                this.edit();
            });
            this.dom.wrapper.addEventListener('mouseleave', () => {
                this.render();
            });
        })();
        root.appendChild(this);
    }

    // static facing
    syncStaticAttrs() {
        Notebox.recent = this;
    }
    // external
    appendChild(child) {
        this.children.set(child.id, child);
        this.dom.wrapper.appendChild(child.dom.wrapper);
    }
    removeChild(child) {
        child.dom.wrapper.remove();
        this.children.delete(child.id);
    }
    // UX
    async setMode(mode) {
        this.syncStaticAttrs();
        this.mode = mode || 1-this.mode;
        switch (this.mode) {
            case 0:
                this.cmEditor.getWrapperElement().style.display = "none";
                this.dom.display.style.display = "inherit";
                break;
            case 1:
                this.cmEditor.setSize(this.w, this.h || 'auto');
                this.dom.display.style.display = "none";
                this.cmEditor.getWrapperElement().style.display = "inherit";
                this.cmEditor.refresh();
                this.cmEditor.focus();
        }
    }
    async edit() {
        if (this.mode === 1) return;
        this.cmEditor.setValue(this.contents);

        this.setMode(1);
    }
    async render() {
        this.dom.wrapper.style.left = this.x+"px";
        this.dom.wrapper.style.top = this.y +"px";

        if (this.mode === 0) return;
        this.contents = this.cmEditor.getValue();
        this.dom.display.innerHTML = this.andoc.mdConverter.makeHtml(this.contents);

        this.setMode(0);
    }
    async focus() {
        this.dom.wrapper.classList.add('doc-focused');
    }
    async blur() {
        this.dom.wrapper.classList.remove('doc-focused'); // unfocus in dom
    }
    // back end
    export() {
        console.log(self.id, self.children);
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            w: self.w,
            h: self.h,
            inner: self.display.innerHTML,
            children: Array.from(self.children, ([key, value]) => value.export())
        };
    }
}

CodeMirror.commands.save = function () {
    global_andoc.unedit();
};

window.onload = () => {
    let keybinds = new Map();
    keybinds.set('cool', (com) => {console.log('cool:', com);});

    global_andoc = new AnDoc(document.getElementById('float-absolute-root'));
    global_andoc.createNote(global_andoc.main, 100, 100, 600, 400);
}

window.onbeforeunload = () => {
    const saveContents = (filename, contents, replacer) => {
        return;
        var element = document.createElement('a');
        element.setAttribute('href', 'data:application/javascript;charset=utf-8,' + JSON.stringify(contents, replacer, 4));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    // saveContents("untiled", main.export());
}

