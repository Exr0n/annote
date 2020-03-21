"use strict";

var main;

var converter = new showdown.Converter();
converter.setFlavor('github');

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

function Notebox(root, x, y, w, h, inner) {
    var self = {
        id: Notebox.assignId(),
        x: x,
        y: y,
        w: w,
        h: h,
        mode: 0, // 0 = disp, 1 = edit
        children: new Map(),
        wrapper: document.createElement("div"),
        display: document.createElement("div"),
        cmEditor: undefined
    }
    if (typeof self.w === 'undefined') self.w = "95%"; else if (typeof self.w === 'number') self.w += 'px';
    if (typeof self.h === 'undefined') self.h = "95%"; else if (typeof self.h === 'number') self.h += 'px';
    self.wrapper.setAttribute('class', 'float-wrap');
    self.wrapper.style = `left: ${self.x}px; top: ${self.y}px; width: ${self.w}; height: ${self.h};`;
    self.display.setAttribute('class', 'float-disp');
    self.display.innerHTML = inner || `<a name=notebox-${self.id}></a>\n`;
    self.cmEditor = CodeMirror((cm) => {
        self.wrapper.appendChild(cm); // construct codemirror
    }, cmOpts);
    self.cmEditor.getWrapperElement().style.display = "none";
    self.wrapper.appendChild(self.display);

    // static facing
    ((self) => {
        self.syncStaticAttrs = () => {
            Notebox.recent = self;
        }
    })(self);
    // external
    ((self) => {
        self.appendChild = (child) => {
            self.children.set(child.id, child);
            self.wrapper.appendChild(child.wrapper);
            console.log(self.children);
        }
    })(self);
    // UX
    ((self) => {
        self.setMode = (mode) => {
            self.syncStaticAttrs();
            self.mode = mode || 1-self.mode;
            switch (self.mode) {
                case 0:
                    self.cmEditor.getWrapperElement().style.display = "none";
                    self.display.style.display = "inherit";
                    break;
                case 1:
                    self.cmEditor.setSize(self.w, self.h);
                    self.display.style.display = "none";
                    self.cmEditor.getWrapperElement().style.display = "inherit";
                    self.cmEditor.refresh();
            }
        }
        self.edit = () => {
            if (self.mode === 1) return;
            const sanitize = (html) => {
                let markdown = converter.makeMarkdown(html);
                markdown = markdown.replace('<!-- -->', ''); // remove empty html comment
                markdown = markdown.replace('\n\n\n', '\n\n'); // remove duplicated newlines
                return markdown;
            }
            console.log("\nHTML", self.display.innerHTML);
            self.cmEditor.setValue(sanitize(self.display.innerHTML));
            console.log("MD", self.cmEditor.getValue());

            self.setMode(1);
        }
        self.render = () => {
            if (self.mode === 0) return;
            console.log("\nMD", self.cmEditor.getValue());
            self.display.innerHTML = converter.makeHtml(self.cmEditor.getValue());
            console.log("HTML", self.display.innerHTML);

            self.setMode(0);
        }
    })(self);
    // back end
    ((self) => {
        self.export = () => {
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
    })(self);

    self.wrapper.addEventListener('click', (e) => {
        e.stopPropagation(); // https://stackoverflow.com/a/10554459
        self.edit();
    });
    self.wrapper.addEventListener('mouseleave', () => {
        self.render();
    });

    root.appendChild(self);
    return self;
}
Notebox.assignId = () => {
    return Notebox.assignId._gen.next().value;
}
Notebox.assignId._gen = (function *() {
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    const increment = (str, idx) => {
        // console.log("increment", str, id.length+idx);
        let newChar = String.fromCharCode((str.charCodeAt(id.length+idx)-97 +1)%26+97);
        // console.log("replace:", str, "=>", str.slice(0, id.length+idx+1), "|", newChar, "|", str.slice(id.length+idx+2));
        return str.slice(0, id.length+idx) + newChar + str.slice(id.length+idx+1);
    }
    var id = 'a';
    while (true) {
        yield id;
        // shift id: a, b, ..., z, aa, ab, ...
        let idx = 0;
        do {
            --idx;
            // console.log("-idx:", -idx, "len:", id.length, "id:", id);
            if (-idx-1 == id.length) {
                id = 'a' + id;
                break;
            }
            id = increment(id, idx);
        } while (id[id.length+idx] == letters[0])
    }
})();

function Document(rootElement) {
    var self = {
        root: rootElement
    };
    self.appendChild = (notebox) => {
        rootElement.appendChild(notebox.wrapper);
    }
    return self;
}

CodeMirror.commands.save = function () {
    Notebox.recent.render();
};

window.onload = () => {
    var root = Document(document.getElementById('float-absolute-root'));
    main = Notebox(root, 0, 0);
    let sub = Notebox(main, 100, 100, 600, 400);
}

window.onbeforeunload = () => {
    console.log("unload")
    const saveContents = (filename, contents, replacer) => {
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

