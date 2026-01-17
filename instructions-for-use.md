## Setting up
Before you start the game, you need to add pictures of all the cards in `/assets/card-images`.
I can give a zip of all the card images I've found, but it isn't the official images for each
card. If you want to change the card images, make sure to keep the file name the same and the
file extension as `.jpg`.

## To start
Run `update-and-run.bat` (Windows) or `update-and-run.sh` (Mac/Linux). The backend should start;
you should see a big QR code. The `localhost` link should bring anyone on the same Wi-Fi network
to the SONA client. If you port forward port 4000 (there's a bunch of tutorials on how to do this)
then anyone with the IP link (the one that's just numbers) can connect to the SONA client.

## Before you play
Currently, I highly recommend playing the game with the web console open. To open the console, press 
Ctrl+Shift+I. After you open the console, reload the page. This window will show any relevant 
instructions on how to use some cards. 

There also isn't a way to choose what deck you want; I'm going to throw together a quick and dirty
solution to fix that (if i havent already)

There are also a couple things you can type for some additional output. Each of these need to be typed
or copied in, then you need to press Enter.
- `logGame()` - outputs the game as the CLIENT sees it. This can be very confusing; chances are you
won't need to use this often (unless i ask you to show me something in this command)
- `serverDump()` - outputs the game as the SERVER sees it. This will be a little more useful: under
the text "Server Game", there's a blob you can click on to expand. This blob contains all the cards
in this game and where they're at, how many crisises each side has, who's turn it is, and how many
actions they have left. Any line with an arrow next to it (🢒) can be clicked to be expanded; this 
can be useful for big card groups like the deck or the runaway pile.
- `showNetworkLogs=true` - turns on packet logging. You also probably won't need to use this often.

## How matchmaking works
Matchmaking right now is *very* minimal. Once you load the site, you get placed in a queue. If
there's someone else in the queue who also hasn't found a game yet, you're paired with them and
your game starts. This means that every time you reload the page, you enter the queue again.
This can lead to the situation where it looks like you've connected to someone, but in realty you've
joined a game with yourself. Just keep that in mind when connecting :3

## Playing a game
### Starting
Once you're connected to someone else, you should see their deck and hand. Pick a level 1 card and place
it in any of the 3 slots on your side; these are your fields. Once you've placed your card, pick
if you want to go first, you want to go second, or if you don't care. If you and your opponent pick
the same option, you'll do a coinflip to see who starts first. 
### Turns
Once it's your turn, you can do a couple things:
- Place a card: click a card in your hand, bring it to an empty field slot, then click to place it.
- Pass your turn: Click the Pass button at the bottom of the screen. This might not always be
available; it should show any time you don't have 6 cards in your hand.
- Make a scare attempt: Click on any card on your fields. While zoomed into the board like this, you
can click any other card to switch to that one instead. Then, click any of the 3 stats on that card
you want to attack with. (there isn't a visual indication of which one you picked yet sorry) Finally, 
click the opposing card you want to attack.
- Use a card action: Click on any card on your fields. Then, click the card with the card action
you want to use. If you can't use the card action (if it's a last action and you're on your first action,
or some other reason) then it should kick you back out without using up an action. 
  - Once you use the 
  card action successfully, look in the console for any additional instructions you might need. These
  are written in teal.
  - Some card actions have the ability to cancel: if you see the cancel button at the bottom of your 
  screen, you can back out of the current action without using up an action.

If you have more than 5 cards in your hand at any time, you should only have the option to discard.
To discard, click the card in your hand you want to discard, bring it to the runaway pile, (to the left
of your hand, and below your crisis marker) and click the runaway pile.

### Winning the game
Currently, when someone wins the game, the game just locks up. There is no visual indicator :c

### Last thoughts
If there's anything unclear or strange, I welcome any dms :3

The UI is currently VERY unpolished; currently it's just enough to be workable. The next big project
I want to work on is overhauling the UI and the visuals, and I want to go through that process with
a lot more input from you two than I had during this stage. There is currently a bug I haven't addressed
and I won't: sometimes when leaving a card selection screen, some cards get stuck in the middle of the
board. I know exactly why this happens, and it won't happen once the UI overhaul is done.

Additionally, I would love any and all pointers on visual directions you want to go in; I would much
rather consider an outlandish request than not hear it. 

I would also love any ideas on features that aren't the game, namely: what deckbuilding should look
like, what matchmaking should look like, any other features like that
