var rendered, cmPlaceholder;
var cmEditor; // codemirror editor

const converter = new showdown.Converter();
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

const edit = () => {
    const sanitize = (html) => {
        let markdown = converter.makeMarkdown(html);
        markdown = markdown.replace('<!-- -->', ''); // remove empty html comment
        markdown = markdown.replace('\n\n\n', '\n\n'); // remove duplicated newlines
        return markdown;
    }
    cmEditor.setValue(sanitize(rendered.innerHTML));

    rendered.style.display = "none";
    cmEditor.getWrapperElement().style.display = "inherit";
    cmEditor.refresh();
}

const render = () => {
    cmEditor.getWrapperElement().style.display = "none";
    rendered.style.display = "inherit";
    rendered.innerHTML = converter.makeHtml(cmEditor.getValue());
}

CodeMirror.commands.save = function () {
    console.log(cmEditor.getValue())
    render();
};

window.onload = () => {
    // init codemirror
    cmPlaceholder = document.getElementById('cmplaceholder'); // get codemirror location
    cmEditor = CodeMirror((cm) => {
        cmPlaceholder.parentNode.replaceChild(cm, cmPlaceholder); // construct codemirror
    }, cmOpts);
    cmEditor.getWrapperElement().style.display = "none"; // hide codemirror

    // init rendered notes
    rendered = document.getElementById('rendered');
    rendered.addEventListener('click', edit);

    // event listeners
    cmEditor.on('blur', render);

    rendered.innerHTML = converter.makeHtml('# Markdown w/ Showdown\n\n- epic\n- lists\n```python\ndef foo():\n    print("foo")\n```');
}

