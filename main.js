var rendered, ediitor;

const converter = new showdown.Converter();
converter.setFlavor('github');

const edit = () => {
    const sanitize = (html) => {
        let markdown = converter.makeMarkdown(html);
        markdown = markdown.replace('<!-- -->', ''); // remove empty html comment
        markdown = markdown.replace('\n\n\n', '\n\n'); // remove duplicated newlines
        return markdown;
    }
    // const stretchFit = (textarea) => {
    //     var val = textarea.value;
    //     var cols = textarea.cols;
    //     var linecount = 0;
    //     val.split('\n').forEach((l) => {
    //         linecount += Math.ceil(l.length / cols);
    //     });
    //     textarea.rows = 2*linecount;
    //     // textarea.display.height = '' + linecount + 'em';
    // }

    // console.log(rendered.clientHeight);
    editor.clientWidth = rendered.clientWidth;
    editor.style.height = '' + rendered.clientHeight + 'px';
    rendered.style.display = "none";
    editor.style.display = "inherit";

    editor.value = sanitize(rendered.innerHTML);
    // stretchFit(editor);
}
const render = () => {
    // console.log("converting MD > HTML")
    // console.log(rendered.innerHTML)

    editor.style.display = "none";
    rendered.style.display = "inherit";
    rendered.innerHTML = converter.makeHtml(editor.value);
    // content.innerHTML = marked(content.innerHTML);
}

window.onload = () => {
    rendered = document.getElementById('rendered');
    editor = document.getElementById('editor');

    // rendered.addEventListener('focus', edit);
    rendered.addEventListener('click', edit);
    // rendered.addEventListener('mouseenter', edit);

    editor.addEventListener('blur', render);
    editor.addEventListener('mouseleave', render);

    rendered.innerHTML = marked('# Markdown w/ Showdown\n\n- epic\n- lists');
}

