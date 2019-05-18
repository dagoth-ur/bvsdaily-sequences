//@SequenceName: Daily Intro

//@SequenceCode

var _testing = true;

//------------------------------------------
//@NewTask
//@TaskName: Breakfast bingo

GoPage('breakfast');

IncrementTaskIf(false); // TODO

FormCheck('dobfast', 'bfconfirm');
FormCheck('dobfast', 'tr-bfast');

FormCheck('dobfast', 'bingo-b1');
FormUncheck('dobfast', 'bingo-b2');
FormCheck('dobfast', 'bingo-b3');
FormUncheck('dobfast', 'bingo-b4');
FormCheck('dobfast', 'bingo-b5');

FormSubmit('dobfast');

//------------------------------------------
//@NewTask
//@TaskName: Pachinko

// Test if we're at machine.
if (LocationTest('partyhouse-pachinkoplay.html')) {
    // End if used all balls
    IncrementTaskIf(DocTest('Electrum: 0'));
    // Otherwise, keep using
    (function () {
        var regex = /Electrum: (\d+)/;
        var balls = parseInt(regex.exec(document.body.innerHTML)[1]);
        if (FormSetValue('dropball', 'numdrop', Math.min(balls, 1000)))
            FormSubmit('dropball');
    })();
}

// Else navigate to page
GoPage('ph_pachinko');
if (DocTest('You survey the rows of machines, including the ominous one'
           +' in the back')) {
    FormSubmit('startpc');
}
// Buy balls
if (DocTest('Buys today: 0'))
    FormSubmit('buyballs');
// Goto first machine
if (FormRadioById('playapachi', 'pmach1'))
    FormSubmit('playapachi');

//------------------------------------------
//@NewTask
//@TaskName: Tsukiball
GoPage('ph_tsukiball');

if (FormRadio('skic', 'tixtype', 'plastic'))
    FormSubmit('skic');

if (DocTest('You are on Ball')) {
    FormRadio('skib', 'rolltype', 'high');
    FormCheck('skib', 'doemall');
    FormSubmit('skib');
} else if (!DocTest('Final Score:')) {
    FormSelect('skib', 'megatsuki', false, 'Play a MegaGame');
    FormSubmit('skib');
}

IncrementTask();

//
//@NewTask
//@TaskName: Strawberry Team

GoPage('team');
TeamChange('Strawberry', 'Shorty', 'Robogirl');
IncrementTask();

//
//@NewTask
//@TaskName: Arena stuff
GoPage('arena');
