"use strict";

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

function Notebox(root, x, y, w, h) {
    var self = {
        id: Notebox.assignId(),
        x: x,
        y: y,
        w: w,
        h: h,
        mode: 0, // 0 = disp, 1 = edit
        wrapper: document.createElement("div"),
        display: document.createElement("div"),
        cmEditor: undefined
    }
    self.wrapper.setAttribute('class', 'float-wrap');
    self.wrapper.style = `left: ${self.x}px; top: ${self.y}px; width: ${self.w}px; height: ${self.h}px;`;
    self.display.setAttribute('class', 'float-disp');
    self.display.innerHTML = `<a name=notebox-${self.id}></a>\n`;
    self.cmEditor = CodeMirror((cm) => {
        self.wrapper.appendChild(cm); // construct codemirror
    }, cmOpts);
    self.cmEditor.getWrapperElement().style.display = "none";
    self.wrapper.appendChild(self.display);
    root.appendChild(self.wrapper);

    self.wrapper.addEventListener('click', () => {
        self.edit();
    });
    self.wrapper.addEventListener('mouseleave', () => {
        self.render();
    });
    self.syncStaticAttrs = () => {
        Notebox.recent = self;
    }
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

// const edit = () => {
//     const sanitize = (html) => {
//         let markdown = converter.makeMarkdown(html);
//         markdown = markdown.replace('<!-- -->', ''); // remove empty html comment
//         markdown = markdown.replace('\n\n\n', '\n\n'); // remove duplicated newlines
//         return markdown;
//     }
//     cmEditor.setValue(sanitize(rendered.innerHTML));
//     cmEditor.setSize(rendered.clientWidth, rendered.clientHeight);

//     rendered.style.display = "none";
//     cmEditor.getWrapperElement().style.display = "inherit";
//     cmEditor.refresh();
// }

// const render = () => {
//     cmEditor.getWrapperElement().style.display = "none";
//     rendered.style.display = "inherit";
//     rendered.innerHTML = converter.makeHtml(cmEditor.getValue());
// }

CodeMirror.commands.save = function () {
    // console.log(cmEditor.getValue())
    // render();
    Notebox.recent.render();
};

window.onload = () => {
    var root = document.getElementById('float-root');
    let main = Notebox(root, 200, 1400, 600, 400);

    // // init codemirror
    // cmPlaceholder = document.getElementById('cmplaceholder'); // get codemirror location
    // cmEditor = CodeMirror((cm) => {
    //     cmPlaceholder.parentNode.replaceChild(cm, cmPlaceholder); // construct codemirror
    // }, cmOpts);
    // cmEditor.getWrapperElement().style.display = "none"; // hide codemirror

    // // init rendered notes
    // rendered = document.getElementById('rendered');
    // rendered.addEventListener('click', edit);

    // // event listeners
    // cmEditor.on('blur', render);

    // rendered.innerHTML = converter.makeHtml('# Annote Alpha\n\n- epic\n- lists\n```python\ndef foo():\n    print("foo")\n```');
}

