var content

function getSelectionCharacterOffsetWithin(element) {
    // https://stackoverflow.com/a/4812022
    var start = 0;
    var end = 0;
    var doc = element.ownerDocument || element.document;
    var win = doc.defaultView || doc.parentWindow;
    var sel;
    if (typeof win.getSelection != "undefined") {
        sel = win.getSelection(); // get user selection
        if (sel.rangeCount > 0) { // if the selection has ranges (this should always be true given prev condition)
            var range = sel.getRangeAt(0); // get first range
            var preCaretRange = range.cloneRange(); // duplicate it
            preCaretRange.selectNodeContents(element); //
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            start = preCaretRange.toString().length;
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            end = preCaretRange.toString().length;
        }
    } else if ( (sel = doc.selection) && sel.type != "Control") {
        var textRange = sel.createRange();
        var preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint("EndToStart", textRange);
        start = preCaretTextRange.text.length;
        preCaretTextRange.setEndPoint("EndToEnd", textRange);
        end = preCaretTextRange.text.length;
    }
    // return { start: start, end: end };
}

function reportSelection() {
    // var selOffsets = getSelectionCharacterOffsetWithin( content );
    var selOffsets = customReport(content);
    document.getElementById("selectionLog").innerHTML = "Selection offsets: " + selOffsets.start + ", " + selOffsets.end;
}

function customReport(element) {
    var start = 0;
    var end = 0;
    var doc = element.ownerDocument || element.document;
    var win = doc.defaultView || doc.parentWindow;
    var sel;
    if (typeof win.getSelection != "undefined") { // selection made by user
        sel = window.getSelection(); // get cursor selection
        if (sel.rangeCount > 0) { // atleast one selection exists
            var range = win.getSelection().getRangeAt(0);
            return { start: range.startContainer.tagName, end: range.endContainer.tagName };
        }
    }
    return { start: undefined, end: undefined }
}

window.onload = () => {
    content = document.getElementById('content');

    content.innerHTML = marked('<p>##amazing</p>');

    content.addEventListener('input', () => {
        console.log('edit!')
        console.log(content.innerHTML)
        console.log(marked(content.innerHTML))
    })

    content.onclick = (e) => {
        // TODO: needed?
    }

    // https://stackoverflow.com/a/4812022
    document.addEventListener("selectionchange", reportSelection, false);
    document.addEventListener("mouseup", reportSelection, false);
    document.addEventListener("mousedown", reportSelection, false);
    document.addEventListener("keyup", reportSelection, false);
}

