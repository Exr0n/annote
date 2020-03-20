var content

const converter = new showdown.Converter();

function sanitize(html) {
    let markdown = converter.makeMarkdown(html).slice(0, -10);
    console.log(markdown);

    // markdown = new DOMParser().parseFromString(markdown, 'text/html').body.textContent;
    // console.log(markdown);

    return markdown;
}

window.onload = () => {
    content = document.getElementById('content');

    content.innerHTML = marked('# Markdown w/ Marked\n\n- epic\n- lists');

    content.addEventListener('focus', () => {
        content.innerHTML = sanitize(content.innerHTML);
    })

    content.addEventListener('blur', () => {
        console.log("converting MD > HTML")
        console.log(content.innerHTML)

        content.innerHTML = converter.makeHtml(content.innerHTML);
        // content.innerHTML = marked(content.innerHTML);
    })
}

