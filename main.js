var rendered, ediitor;

const converter = new showdown.Converter();
converter.setFlavor('github');

CodeMirror.commands.save = function () {
    alert("Saving");
    render();
};

// code mirror opts
const cmOpts = {
    lineNumbers: true,
    mode: "markdown",
    keyMap: "vim",
    showCursorWhenSelecting: true
}

const edit = () => {
    const sanitize = (html) => {
        let markdown = converter.makeMarkdown(html);
        markdown = markdown.replace('<!-- -->', ''); // remove empty html comment
        markdown = markdown.replace('\n\n\n', '\n\n'); // remove duplicated newlines
        return markdown;
    }
    editor.clientWidth = rendered.clientWidth;
    editor.style.height = '' + rendered.clientHeight + 'px';
    rendered.style.display = "none";
    editor.style.display = "inherit";

    editor.value = sanitize(rendered.innerHTML);
    var myCodeMirror = CodeMirror.fromTextArea(editor, cmOpts);
}
const render = () => {
    editor.style.display = "none";
    rendered.style.display = "inherit";
    rendered.innerHTML = converter.makeHtml(editor.value);
}

window.onload = () => {
    rendered = document.getElementById('rendered');
    editor = document.getElementById('editor');

    rendered.addEventListener('click', edit);

    editor.addEventListener('blur', render);
    editor.addEventListener('mouseleave', render);

    rendered.innerHTML = converter.makeHtml('# Markdown w/ Showdown\n\n- epic\n- lists');
}

