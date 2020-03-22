"use strict";

// code mirror opts
const cmOpts = {
    lineNumbers: true,
    mode: "markdown",
    theme: "ayu-dark",
    keyMap: "vim",
    indentUnit: 4,
    showCursorWhenSelecting: true
}

const initialize = () => {
    // showdown extension: https://github.com/showdownjs/showdown/wiki/extensions
    // TODO: doesn't work
    (function (extension) {
        if (typeof showdown !== 'undefined') {
            // global (browser or nodejs global)
            extension(showdown);
        } else if (typeof define === 'function' && define.amd) {
            // AMD
            define(['showdown'], extension);
        } else if (typeof exports === 'object') {
            // Node, CommonJS-like
            module.exports = extension(require('showdown'));
        } else {
            // showdown was not found so we throw
            throw Error('Could not find showdown library');
        }
    }(function (showdown) {
        // loading extension into shodown
        showdown.extension('myext', function () {
            var myext = { /* ... actual extension code ... */ };
            return [myext];
        });
    }));
    // TODO: anchor links (https://github.com/showdownjs/showdown/issues/344)
}

class AnDoc{
    constructor(rootElement) {
        this.root = rootElement;
        this.notes = new Map();

        this.converter = new showdown.Converter({
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
                showdownKatex({
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

        /// TODO: Unused -- hard to tell which box was right clicked on
        // document.addEventListener('contextmenu', (evt) => {
        //     evt.preventDefault();
        //     console.log(evt.target.id)
        //     this.notes.get(evt.target.id).edit();
        //     return false;
        // });

        this.main = new Notebox(this, 0, 0);
    }
    assignId() {
        return this.idGenerator.next().value;
    }
    registerNote(note) {
        this.notes.set(note.id, note);
    }
    createNote(root, x, y, w, h, content) {
        this.registerNote(note);
        root = root || this.root;
        let note = new Notebox(root, x, y, w, h, content);
        return note;
    }
    appendChild(note) {
        this.registerNote(note)
        this.root.appendChild(note.wrapper);
    }
}

class Notebox {
    constructor(root, x, y, w, h, contents) {
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
            this.wrapper = document.createElement("div");
            this.wrapper.setAttribute('id', this.id);
            this.wrapper.setAttribute('class', 'float-wrap');
            this.wrapper.style.left = this.x + 'px';
            this.wrapper.style.top = this.y + 'px';
            this.wrapper.style.width = this.w + 'px';
            if (this.h) this.wrapper.style.height = this.h + 'px';

            this.display = document.createElement("div");
            this.display.setAttribute('class', 'float-disp');
            this.display.innerHTML = this.andoc.converter.makeHtml(this.contents);
            this.wrapper.appendChild(this.display);

            this.cmEditor = CodeMirror((cm) => {
                this.wrapper.appendChild(cm); // construct codemirror
            }, cmOpts);
            this.cmEditor.getWrapperElement().style.display = "none";

            this.wrapper.addEventListener('click', (e) => {
                e.stopPropagation(); // https://stackoverflow.com/a/10554459
                this.edit();
            });
            this.wrapper.addEventListener('mouseleave', () => {
                this.render();
            });
        })();
        root.appendChild(this);
    }

    // static facing
    syncStaticAttrs() {
        Notebox.recent = this; // TODO: should be a property of the document
    }
    // external
    appendChild(child) {
        this.children.set(child.id, child);
        this.wrapper.appendChild(child.wrapper);
    }
    // UX
    setMode(mode) {
        this.syncStaticAttrs();
        this.mode = mode || 1-this.mode;
        switch (this.mode) {
            case 0:
                this.cmEditor.getWrapperElement().style.display = "none";
                this.display.style.display = "inherit";
                break;
            case 1:
                this.cmEditor.setSize(this.w, this.h);
                this.display.style.display = "none";
                this.cmEditor.getWrapperElement().style.display = "inherit";
                this.cmEditor.refresh();
                this.cmEditor.focus();
        }
    }
    edit() {
        if (this.mode === 1) return;
        this.cmEditor.setValue(this.contents);

        this.setMode(1);
    }
    render() {
        if (this.mode === 0) return;
        this.contents = this.cmEditor.getValue();
        this.display.innerHTML = this.andoc.converter.makeHtml(this.contents);

        this.setMode(0);
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
    Notebox.recent.render(); // TODO: use document
};

window.onload = () => {
    var root = new AnDoc(document.getElementById('float-absolute-root'));
    let sub = new Notebox(root.main, 100, 100, 600, 400);
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

    saveContents("untiled", main.export());
}

