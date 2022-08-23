// Save important constants
const gameId = document.querySelector('#game-id').value;
const playlistId = document.querySelector('#playlist-id').value;
const accessToken = document.querySelector('#access-token').value;
const refreshToken = document.querySelector('#refresh-token').value;
const currentUser = {
    'username': document.querySelector('#username').value,
    'user_id': document.querySelector('#user-id').value
};

const isAdmin = (currentUser['user_id'] === gameId);

const numberOfTracks = 10;
const numberOfTrackSuggestions = 5;

const trackPlayTime = 30_000;
const trackPlayInterval = 6_000;
const scoreDisplayInterval = 6_000;
const gameLoadTime = 3_000;


let gameTracks = [];

let connectedUsers = {};
let readyUsers = [];

let scores = {};

let currentTrack = 0;

let timeouts = [];

// Set event handlers
document.querySelector('#copy-code-button').onclick = copyGameCode;
document.querySelector('#track-search').onkeyup = searchTrack;

if (isAdmin) {
    document.querySelector('#start-game-button').onclick = sendLoadGame;
}


// Create and configure a websocket.
const socket = new WebSocket(
    'ws://'
    + window.location.host
    + '/ws/game/'
    + gameId
    + '/username/'
    + currentUser['username']
    + '/userid/'
    + currentUser['user_id']
    + '/'
);


socket.onopen = (e) => {
    console.log('Socket opened!');
    // Get previously connected users
    sendPollRequest();
};


socket.onmessage = (e) => {
    // Load the message
    const data = JSON.parse(e.data);
    const message = data['message'];
    // Print to the console
    console.log(message);

    // Do something...
    switch (message['type']) {

        case 'LOAD_GAME':
            loadGame(message['tracks']);
            break;

        case 'USER_CONNECTED':
            userConnected(message['user']);
            break;

        case 'USER_DISCONNECTED':
            userDisconnected(message['user']);
            break;

        case 'USER_READY':
            userReady(message['user']);
            break;

        case 'USER_SCORE':
            userScore(message['user']['user_id'], message['score']);
            break;

        case 'NEXT_TRACK':
            nextTrack();
            break;

        case 'POLL_REQUEST':
            sendUserConnected();
            break;
    
        default:
            break;
    }

};


socket.onclose = (e) => {
    console.log('Socket closed!');
};


function sendUserConnected() {
    // Send user details
    socket.send(JSON.stringify(
        {'message': {
            'type': 'USER_CONNECTED',
            'user': currentUser,
            'message': `User ${currentUser['username']} has been connected!` 
        }}
    ))
}


function sendPollRequest() {
    // Ask all previously connected users to send their details
    socket.send(JSON.stringify(
        {'message': {
            'type': 'POLL_REQUEST'
        }}
    ))
}


function userConnected(user) {
    connectedUsers[user['user_id']] = user;
    displayConnectedUsers();
}


function userDisconnected(user) {
    delete connectedUsers[user['user_id']];
    displayConnectedUsers();
}


function displayConnectedUsers() {

    // Update the number of connected users
    document.querySelector('#number-of-connected-users').innerHTML = Object.keys(connectedUsers).length;

    // Get the div that holds connected users
    const connectedUsersDiv = document.querySelector('#connected-users');

    // Update its children
    connectedUsersDiv.replaceChildren(
        ...Object.values(connectedUsers).map(user => {
            let div = document.createElement('div');
            div.setAttribute('class', 'user-display gray-rounded wrap-ellipsis');
            div.innerHTML = user['username'];
            return div;
        })
    );
}


function sendLoadGame() {

    // Disable the start game button
    document.querySelector('#start-game-button').setAttribute('disabled', '');

    // Fetch 5 random tracks from the selected playlist
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
    })
    .then(response => response.json())
    .then(response => {
        // Get tracks from the playlist
        let tracks = response['tracks']['items'].map((item) => {
            return item['track'];
        })
        // Filter out tracks without a preview url
        tracks = tracks.filter((item) => {
            return item['preview_url'] !== null;
        })
        // Pick random tracks from the list
        tracks = tracks.sort(() => 0.5 - Math.random()).slice(0, numberOfTracks);
        return tracks;
    })
    .then(tracks => {
        // Create a message
        let message = {'message': {
            'type': 'LOAD_GAME',
            'tracks': tracks
        }};
        // Ask all connected players to load the game
        socket.send(JSON.stringify(message));
    })
}


function nextTrack() {

    const trackSearch = document.querySelector('#track-search');
    
    // Clear input field
    trackSearch.value = '';
    // Enable and focus input
    trackSearch.disabled = false;
    // Hide the scores display
    hideScores();

    const trackDivs = document.querySelectorAll('.track-div');
    // Clear the ready list
    readyUsers.length = 0;

    if (currentTrack !== 0) {
        // Stop the previous track
        trackDivs[currentTrack - 1].querySelector('audio').pause();
        // Hide the previous track div
        trackDivs[currentTrack - 1].setAttribute('hidden', '');
    }

    // Move to the next track
    currentTrack++;

    // Show the current track div
    trackDivs[currentTrack - 1].removeAttribute('hidden');
    // Play the track
    trackDivs[currentTrack - 1].querySelector('audio').play();

    timeouts[currentTrack - 1] = setTimeout(endRound, trackPlayTime);
}


function endRound() {
    // Reveal track
    revealTrack();
    // Send score
    sendUserScore();

    setTimeout(() => {
        // Display scores
        displayScores();
        // After another n seconds, sendUserReady
        setTimeout(() => {
            sendUserReady();
        }, scoreDisplayInterval);
    }, trackPlayInterval);
}


function updateScoresDisplay() {

    let rows = [];

    // Sort users in descending order of scores
    let sortedUsers = Object.keys(scores).sort((a, b) => {
        return scores[b] - scores[a]
    })

    // Create rows for each user
    for (const user of sortedUsers) {
        // Create a table row and two cells
        let row = document.createElement('tr');
        let cell1 = document.createElement('td');
        let cell2 = document.createElement('td');
        // Apply styles
        cell1.setAttribute('class', 'wrap-ellipsis');
        cell2.setAttribute('class', 'wrap-ellipsis');
        if (user === currentUser['user_id']) {
            row.style.color = '#1db954';
        }
        // Place cells in the row
        row.append(cell1, cell2)
        // Fill in the user's score details
        cell1.innerHTML = connectedUsers[user]['username'];
        cell2.innerHTML = scores[user];
        rows.push(row);
    }

    // Update the scores display
    document.querySelector('#scores-table')
        .querySelector('tbody')
        .replaceChildren(...rows)
}


function hideScores() {
    switchDisplay(
        document.querySelector('#scores-display'),
        document.querySelector('#playing-room'),
    )
}


function displayScores() {
    switchDisplay(
        document.querySelector('#playing-room'),
        document.querySelector('#scores-display'),
    )
}


function revealTrack() {

    const trackSearch = document.querySelector('#track-search');
    const trackDivs = document.querySelectorAll('.track-div');
    // Disable further input
    trackSearch.disabled = true;
    // Show track image
    trackDivs[currentTrack - 1].querySelector('.blank-cover').setAttribute('hidden', '');
    trackDivs[currentTrack - 1].querySelector('.filled-cover').removeAttribute('hidden')
    // Show artists
    trackDivs[currentTrack - 1].querySelector('.artist-display').innerHTML = getTrackArtists(gameTracks[currentTrack - 1]).join(', ');
    // Add track name
    trackSearch.value = gameTracks[currentTrack - 1]['name'];
    // Clear autocomplete
    document.querySelector('#autocomplete').replaceChildren();
}


function loadGame(tracks) {

    const waitingRoom = document.querySelector('#waiting-room');
    const playingRoom = document.querySelector('#playing-room');
    const tracksContainer = document.querySelector('#tracks-container');

    // Clear any previous tracks
    gameTracks.length = 0;
    // Add new tracks to the list
    for (let i = 0; i < tracks.length; i++) {
        gameTracks[i] = tracks[i];
    }

    // Clear all previous tracks
    tracksContainer.replaceChildren();
    
    // Load each of the tracks.
    tracks.forEach(track => {
        
        // Create elements
        let trackDiv = document.createElement('div');
        let trackCover = document.createElement('img');
        let blankCover = document.createElement('img');
        let audio = document.createElement('audio');
        let source = document.createElement('source');
        let artists = document.createElement('div');

        // Apply classes and attributes
        trackDiv.setAttribute('hidden', '');
        trackDiv.setAttribute('class', 'track-div');


        blankCover.src = "/static/game/blank.svg"
        // blankCover.setAttribute('src', '');
        // blankCover.setAttribute('alt', 'Cover of ?');
        blankCover.setAttribute('class', 'cover-img blank-cover');
        // blankCover.innerHTML = `<i class="bi bi-question"></i>`

        trackCover.setAttribute('src', getTrackCover(track));
        trackCover.setAttribute('alt', `Cover of ${track['name']}`);
        trackCover.setAttribute('class', 'cover-img filled-cover');
        trackCover.setAttribute('hidden', '');

        audio.setAttribute('preload', 'auto');
        source.setAttribute('src', track['preview_url']);
        source.setAttribute('type', 'audio/mp3');

        artists.setAttribute('class', 'artist-display gray-rounded wrap-ellipsis');
        artists.innerHTML = '???';

        // Arrange elements
        audio.appendChild(source);
        trackDiv.append(blankCover, trackCover, audio, artists);

        // Add to the document.
        tracksContainer.appendChild(trackDiv);
    });

    setTimeout(() => {
        // Hide the waiting room and show the game room
        switchDisplay(waitingRoom, playingRoom);
        // Send a ready message
        sendUserReady();
    }, gameLoadTime);
}


function sendUserReady() {
    socket.send(JSON.stringify(
        {'message': {
            'type': 'USER_READY',
            'user': currentUser,
            'message': `User ${currentUser['username']} is ready.`
        }}
    ));
}


function userReady(user) {

    // Update to the list of ready users
    readyUsers.push(user['user_id']);

    // If the game is over, stop
    if (currentTrack === numberOfTracks) {
        return;
    }

    if (isAdmin) {
        // If all connected users are ready, move to next song
        if (Object.keys(connectedUsers).every(item => readyUsers.includes(item))) {
            socket.send(JSON.stringify({
                'message': {
                    'type': 'NEXT_TRACK',
                    'message': 'Move to the next track.'
                }
            }));
        }
    };
}


function sendUserScore() {

    const trackDivs = document.querySelectorAll('.track-div');
    const currentTime = trackDivs[currentTrack - 1].querySelector('audio').currentTime;
    const score = Math.round((trackPlayTime / 1000) - currentTime);

    socket.send(JSON.stringify({
        'message': {
            'type': 'USER_SCORE',
            'user': currentUser,
            'score': score,
        }
    }));
}


function userScore(user, score) {
    // Update scores
    if (!(user in scores)) {
        scores[user] = score;
    } else {
        scores[user] += score;
    }
    // Update scores display
    updateScoresDisplay();
}


function checkTrack() {

    if (hashTrack(gameTracks[currentTrack - 1]).toLowerCase() === this.dataset['track'].toLowerCase()) {
        // Reveal the track
        revealTrack();
        // Cancel the timeout
        clearTimeout(timeouts[currentTrack - 1]);
        // End round
        endRound();
    }
}


function searchTrack() {

    const query = document.querySelector('#track-search').value;
    const autocomplete = document.querySelector('#autocomplete');

    if (!query.length) {
        return;
    }

    fetch('https://api.spotify.com/v1/search?' + new URLSearchParams({
        'q': query,
        'type': 'track',
        'limit': numberOfTracks,
    }), {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
    })
    .then(response => response.json())
    .then(response => {

        // Get non-duplicate tracks
        let tracks = [];
        let hashes = [];
        for (const track of response['tracks']['items']) {
            let trackHash = hashTrack(track);
            if (hashes.includes(trackHash)) {
                continue;
            } else {
                tracks.push(track);
                hashes.push(trackHash);
            }
        }
        
        autocomplete.replaceChildren(
            ...tracks.slice(0, numberOfTrackSuggestions).map(track => {
                // Create elements
                let li = document.createElement('li');
                li.dataset['track'] = hashTrack(track);
                li.innerHTML = hashTrack(track);
                li.setAttribute('class', 'track-suggestion wrap-ellipsis');
                li.onclick = checkTrack;
                return li;
            })
        );
    })
}


function getTrackCover(track) {
    return track['album']['images'][0]['url'];
}


function getTrackArtists(track) {
    return track['artists'].map(artist => artist['name']);
}


function hashTrack(track) {
    return `${getTrackArtists(track).sort().join(', ')} - ${track['name']}`
}


function copyGameCode() {
    navigator.clipboard.writeText(gameId)
        .then(() => alert("Copied!"));
}


function switchDisplay(previous, current) {
    // Hide the previous element and show the current one.
    previous.classList.add('no-display');
    current.classList.remove('no-display');
}