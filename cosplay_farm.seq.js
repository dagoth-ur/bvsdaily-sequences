//@SequenceName: Cosplay Farming

// TODO list:
// - Add selecting dealer's room offers (prioritize items not yet in inv).
// - Maybe add updating the inventory after buying something.

//
//@SequenceCode
//

// If this is set to true, no actions will be taken and stuff will get logged
// to the console.
var debug = true;

function dbg(...msg) {
    if (debug)
        console.log(...msg);
}

function DocRegex(re, idx) {
    dbg('Regexing: ' + re);
    var result = re.exec(document.body.innerText);
    dbg('Regex result: ' + result);
    if (idx == undefined || typeof idx != 'number' || result == null) {
        return result;
    } else {
        return result[idx];
    }
}

function DocReInt(re) {
    return parseInt(DocRegex(re, 1));
}

function BvSPlayerId() {
    return $('input[name=player]').value;
}

// 
// XPath and QuerySelector helpers
//
function $x(xpath, context=document) {
    var result = document.evaluate(xpath, context, null, 
                                   XPathResult.ANY_UNORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
}

function $$x(xpath, context=document) {
    var result = document.evaluate(xpath, context, null,
                                   XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                   null);
    var retarr = [];
    var res;
    while ((res = result.iterateNext()))
        retarr.push(res);
    return retarr;
}

function $(selector, context=document) {
    return context.querySelector(selector);
}

function $$(selector, context=document) {
    return Array.from(context.querySelectorAll(selector));
}

//
// Function for figuring out when we are
//

// Returns a yyyy-mm-dd string
function currentUTCDate() {
    var now = new Date();
    var y = now.getUTCFullYear().toString();
    var m = now.getUTCMonth().toString().padStart(2, '0');
    var d = now.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

//
// Stuff for convenient local storage access
//
function StorageProxy(localstorage_prefix) {
    var handler = {
        set(target, prop, newval) {
            dbg(`Setting ${localstorage_prefix}.${prop} to ${newval}`);
            localStorage.setItem(`${localstorage_prefix}.${prop}`, 
                                 JSON.stringify(newval));
        },
        get(target, prop) {
            var ret = JSON.parse(
                localStorage.getItem(`${localstorage_prefix}.${prop}`));
            dbg(`Getting ${ret} from ${localstorage_prefix}.${prop}`);
            return ret;
        },
        deleteProperty(target, prop) {
            localStorage.removeItem(`${localstorage_prefix}.${prop}`);
        }
    };
    return new Proxy({}, handler);
}

//
// Stuff for parsing different BillyCon pages
//

// The page with stats and list of cosplay pieces
function parseConStats() { 
    var cosparts_tables =
        $$x('//tr[td[b[text()="Cosplays"]]]/following-sibling::tr//tbody');
    var pieces = {};
    for (let tab of cosparts_tables) {
        let rows = tab.children;
        // Skip first row with column labels
        for (let i = 1; i < rows.length; i += 2) {
            let cosplay = rows[i].innerText;
            const parts = ["Head", "Body", "Prop"];
            Array.from(rows[i+1].children).slice(0,3).forEach(
                (n, i) => {
                    let match = /Qty: (\d+)/.exec(n.innerText);
                    if (match == null)
                        return;
                    pieces[cosplay + ' ' + parts[i]] = parseInt(match[1]);
                });
        }
    }
    return pieces;
}

// The packing page
function parsePackingInventory() { 
    var labels = $$('ul.checklist label');
    var pieces = [];
    for (let l of labels) {
        let prefix = l.innerText.split('(')[0].trim().split(' ');
        let cosplay = prefix.slice(0, -1).join(' ');
        let part = prefix.slice(-1).join();
        let checkid = l.getAttribute('for');
        pieces.push({cosplay, part, checkid});
    }
    return pieces;
}

// Main con page
function parseConMain() {
    // Noms
    var nom = parseInt(
        $('table.constats tbody').children[1].children[1].innerText);
    // Monies
    var monies = parseInt(
        $('table.constats tbody').children[1].children[3].innerText);
    // Flow
    var flow = parseInt(
        $('table.constats tbody').children[1].children[7].innerText);
    // Can go to dealer's room?
    var dealerRoomOk = ($('option[value=deal]') != null);
    // Are omnoms available?
    var omnomsOk = ($('input[value=eatnom]') != null);
    // Did we just buy a cosplay piece?
    var justBought = null;
    var purchaseMsgNode = 
        $x('//td/i[b[text()="Purchased!"]]/following-sibling::i/b');
    if (purchaseMsgNode) {
        let purchaseMsg = purchaseMsgNode.innerText;
        let piece = purchaseMsg.slice(0, -10);
        if (purchaseMsg.endsWith('Received!') &&
                (piece.endsWith('Body') || piece.endsWith('Head')
                 || piece.endsWith('Prop')))
            justBought = piece;
    }
    // Did we just get cosplay swap offers?
    var swapOffers = [];
    for (let l of $$('form[name=cosswap] label')) {
        let checkid = l.getAttribute('for');
        let [yours, theirs] = l.innerText.split('for their');
        // The \s in the regexes below is because unbreakable spaces 
        // (unicode codepoint U+00A0) occur in page text and they won't match a
        // normal one.
        let [your_piece, your_num] = 
            /Your ([^(]+)[(][^(]*[(]You\shave\s(\d+)/.exec(yours)
            .slice(1).map((s) => s.trim());
        let [their_piece, their_num] =
            /([^(]+)[(][^(]*[(]You\shave\s(\d+)/.exec(theirs)
            .slice(1).map((s) => s.trim());
        [your_num, their_num] = [your_num, their_num].map((s) => parseInt(s));
        swapOffers.push({your_piece, your_num, their_piece, their_num
                        ,checkid});
    }
    // Did we just get dealer's room offers?
    var dealerOffers = [];
    for (let l of $$('form[name=condroom] label')) {
        if (!/Cosplay Piece/.test(l.innerText))
            continue;
        let [rawset, rawrest] = l.innerText.split('Cosplay Piece');
        let set = rawset.trim();
        let price = parseInt(/^\s*(\d+)M/.exec(rawrest)[1]);
        let part = /[(](\S+) Piece/.exec(rawrest)[1];
        let checkid = l.getAttribute('for');
        dealerOffers.push({piece : set + ' ' + part, price, checkid});
    }
    return {nom, monies, dealerRoomOk, omnomsOk, justBought, swapOffers
           ,dealerOffers, flow};
}

//
// Stuff for acting on different BillyCon pages
//

// Packing screen
function packDuplicateCosplays(inventory, max=0) {
    let choices = parsePackingInventory();
    dbg('Dumping inventory from packing page', choices);
    for (let {piece, checkid} of choices) {
        dbg(`Considering cosplay piece: ${piece}`);
        dbg(`  Number owned: ${inventory[piece]}`);
        if (inventory[piece] > 1) {
            if (max-- <= 0)
                break;
            dbg(`  Selecting.`);
            $(`#${checkid}`).checked = true;
        }
    }
}

//
// Stuff for figuring out where we are
//

function recognizePage() {
    if (LocationTest('/bvs/billycon.html')) {
        if (DocTest('Available Actions')) {
            return 'conmain';
        } else if (DocRegex(
                /You may bring up to (\d+) Spaces' worth of stuffs/)) {
            return 'conpack';
        }
    } else if (LocationTest('/bvs/billycon-character.html')) {
        return 'constats';
    } else {
        return 'unknown';
    }
}

// For testing
function FormAction(formname) {
    if (debug) {
        dbg(`Would submit form: ${formname}`);
        ShowMsg('Debug messages printed to console');
    } else {
        FormSubmit(formname);
    }
}

//@NewTask
//@TaskName: Do the thing

var store = StorageProxy('cosplay_farmer-' + BvSPlayerId());
var page = recognizePage();

dbg(`We're on page: ${page}`);

if (store.inventory == null) {
    store.checking_inventory = true;
    GoPage('billycon');
}

if (store.checking_inventory && page !== 'constats') {
    GoPage('billycon');
    FormSubmit('charasheet');
}

if (page === 'constats') {
    store.inventory = parseConStats();
    store.checking_inventory = false;
    store.last_check = currentUTCDate();
}

if (page === 'conpack') {
    let last_check = store.last_check || "0001-01-01";
    if (last_check < currentUTCDate()) {
        store.checking_inventory = true;
        ShowMsg('Proceeding to look at inventory');
    }
    // This needs to be tested next Friday. Unfortunately.
    packDuplicateCosplays(store.inventory, 10);
    FormAction('conroom');
}

if (page === 'conmain') {
    let pageData = parseConMain();
    dbg('Dumping parsed BillyCon main page data', pageData);
    // Check if we have swap offers and maybe pick a good one
    if (pageData.swapOffers.length > 0) {
        for (let off of pageData.swapOffers) {
            dbg('Considering swap offer:', off);
            if (off.your_num > 1 && off.their_num === 0) {
                dbg('  Is good.');
                $(`#${off.checkid}`).checked = true;
                FormAction('cosswap');
            }
        }
    }
    // Check if we have dealer's offers and also maybe pick
    if (pageData.dealerOffers.length > 0) {
        ShowMsg('TODO: do something here');
    }
    // Check if we can go to dealer's room and if there's any point
    if (pageData.dealerRoomOk && pageData.monies >= 5) {
        // I think we need food to go to dealer's. Not sure though.
        if (pageData.nom <= 0) {
            if (pageData.omnomsOk) {
                FormCheck('conaction', 'conaction', 'eatnom');
                FormAction('conaction');
            } else {
                FormCheck('conaction', 'conaction', 'foodcourt');
                FormAction('conaction');
            }
        }
        FormSelect('conaction', 'eventpick', 'deal');
        FormAction('conaction');
    }
    // Otherwise, cosplay swaps until it's done
    // Extra filter. Maybe should use flow here.
    FormCheck('conaction', 'cosswap-c');
    FormCheck('conaction', 'conaction', 'conswap');
    FormAction('conaction');
}

GoPage('billycon');
FormSubmit('gotocon');
