var content

function sanitize(html) {
    html = html.replace("</p><p>", "\n");
    html = html.replace("<li>", "- ")
    console.log(html);
    html = new DOMParser().parseFromString(html, 'text/html').body.textContent;
    console.log(html);

    return html;
}

window.onload = () => {
    content = document.getElementById('content');

    content.innerHTML = marked('# Markdown w/ Marked\n\n- epic\n- lists');

    // content.addEventListener('input', () => {
    //     console.log('edit!')
    //     console.log(content.innerHTML)
    //     console.log(marked(content.innerHTML))
    // })

    content.addEventListener('focus', () => {
        content.innerHTML = '<code>' + sanitize(content.innerHTML) + '</code>';
    })

    content.addEventListener('blur', () => {
        content.innerHTML = marked(content.innerHTML);
    })

    // // https://stackoverflow.com/a/4812022
    // document.addEventListener("selectionchange", reportSelection, false);
    // document.addEventListener("mouseup", reportSelection, false);
    // document.addEventListener("mousedown", reportSelection, false);
    // document.addEventListener("keyup", reportSelection, false);
}

