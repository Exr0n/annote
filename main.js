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
        this.activityChecker = activityChecker;
        this.buffer = [''];
        this.down = [];
        this.listeners = {'change': []};
        this.timeout;

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
        if (ev.key.length === 1) {
            if (!this.down.includes(ev.key)) {
                this.down.push(ev.key);
            }
        }
    }
    async handleUp(ev) {
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
        for (let call of this.listeners[name]) {
            call(data);
        }
    }
}

class AnDoc {
    // class FocusHandler {
        // constructor(andoc, keyHandlerOptions) {
            // this.andoc = andoc;
            // TODO: should this exist to handle focus/edit events? what should it own?
        // }
    // }
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
            disableForced4SpacesIndentedSublists: true,
            extensions: [
                showdownKatex({ // TODO: doesn't work
                    // maybe you want katex to throwOnError
                    throwOnError: true,
                    // disable displayMode
                    displayMode: false,
                    // change errorColor to blue
                    errorColor: '#1500ff',
                }),
                () => { // TODO: link icon doesn't appear... (https://github.com/showdownjs/showdown/issues/344#issuecomment-280804955)
                    var ancTpl = '$1<a id="user-content-$3" class="anchor" href="#$3" aria-hidden="true"><svg aria-hidden="true" class="octicon octicon-link" height="16" version="1.1" viewBox="0 0 16 16" width="16"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"></path></svg></a>$4';

                    return [{
                        type: 'html',
                        regex: /(<h([1-3]) id="([^"]+?)">)(.*<\/h\2>)/g,
                        replace: ancTpl
                    }];
                }
            ],
        });

        this.idGenerator = (function *() {
            var letters = 'abcdefghijklmnopqrstuvwxyz';
            const increment = (str, idx) => {
                let newChar = String.fromCharCode((str.charCodeAt(id.length+idx)-97 +1)%26+97);
                return str.slice(0, id.length+idx) + newChar + str.slice(id.length+idx+1);
            }
            var id = 'a';
            while (true) {
                yield id;
                // shift id: a, b, ..., z, aa, ab, ...
                let idx = 0;
                do {
                    --idx;
                    if (-idx-1 == id.length) {
                        id = 'a' + id;
                        break;
                    }
                    id = increment(id, idx);
                } while (id[id.length+idx] == letters[0])
            }
        })();

        this.dom = {
            messages: document.createElement('div'),
            keyChord: document.createElement('code')
        }
        this.dom.messages.setAttribute('class', 'messages');
        this.dom.messages.appendChild(this.dom.keyChord);
        this.root.appendChild(this.dom.messages);

        this.keyHandler = new KeyHandler(document, AnDoc.keybinds(this, window), this.keyboardActivityChecker.bind(this), config.keyTimeout);
        this.keyHandler.on('change', (evt) => { this.dom.keyChord.innerHTML = evt.keys; });
        this.keyHandler.on('special', this.specialKey.bind(this));

        /// TODO: Unused -- hard to tell which box was right clicked on
        // document.addEventListener('contextmenu', (evt) => {
        //     evt.preventDefault();
        //     console.log(evt.target.id)
        //     this.notes.get(evt.target.id).edit();
        //     return false;
        // });

        this.main = new Notebox(this, 0, 0);
        this.focus(this.main);
    }
    keyboardActivityChecker() {
        return typeof this.editing === 'undefined';
    }
    async specialKey(key) {
        switch (key) {
            case "Enter":
                if (typeof this.focused !== 'undefined') {
                    this.edit(this.focused);
                }
                break;
        }
    }
    assignId() {
        return this.idGenerator.next().value;
    }
    registerNote(note) {
        this.notes.set(note.id, note);
    }
    async focus(note) {
        console.log('focusing', note.id);
        if (this.focused === note) return;
        if (typeof this.focused !== 'undefined') this.focused.blur();
        this.focused = note;
        note.focus();
    }
    async edit(note) {
        if (typeof this.editing !== 'undefined') this.editing.render();
        this.editing = note;
        this.focus(note);
        note.edit();
    }
    async unedit() {
        if (typeof this.editing === 'undefined') return;
        this.editing.render();
        this.focus(this.editing);
        this.editing = undefined;
        document.body.focus();
    }
    async createNote(root, x, y, w, h, content) {
        root = root || this.root;
        let note = new Notebox(root, x, y, w, h, content);
        this.notes.set(note.id, note);
        this.focus(note);
        return note;
    }
    async deleteNote(note) {
        if (note.root instanceof AnDoc) throw new Error("Cannot delete root node!");
        note.root.removeChild(note);
        this.notes.delete(note.id);
        this.focus(note.root);
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
        this.andoc.registerNote(this);

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
    // let keyHandler = new KeyHandler(document, keybinds, 2000);

    global_andoc = new AnDoc(document.getElementById('float-absolute-root'));
    let sub = new Notebox(global_andoc.main, 100, 100, 600, 400);
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

