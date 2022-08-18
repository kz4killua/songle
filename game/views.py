import os
import random
import base64

from django.http import HttpResponseRedirect, JsonResponse
import requests

from django.shortcuts import render


SONGLE_REDIRECT_URI = 'http://localhost:8000/game/spotifyauthorize'


def index(request, username=None, access_token=None, refresh_token=None):
    return render(request, "game/index.html", {
        'username': username,
        'access_token': access_token,
        'refresh_token': refresh_token
    })


def game(request, game_id, is_admin=False, playlist=None):
    # Render the game template.
    return render(request, "game/game.html", {
        'game_id': game_id,
        'is_admin': is_admin,
        'username': request.GET['username'],
        'playlist': playlist,
        'access_token': request.GET['access_token'],
        'refresh_token': request.GET['refresh_token'],
    })


def create_game(request):
    # Generate a random game ID.
    game_id = str(random.randrange(99999))
    # Save the playlist.
    playlist = request.GET['playlist']

    return game(request, game_id, True, playlist)


def join_game(request):
    return game(request, request.GET['game_id'])


def authorize(request):

    if 'code' in request.GET:
        # Load client id and secret
        client_id = os.environ['SONGLE_CLIENT_ID']
        client_secret = os.environ['SONGLE_CLIENT_SECRET']
        # Get base64 encoded client ID and secret
        authorization = f"{client_id}:{client_secret}"        
        authorization = authorization.encode('ascii')
        authorization = base64.b64encode(authorization)
        authorization = authorization.decode('ascii')

        # If a code is present, exchange the code for an access token
        response = requests.post(
            url = 'https://accounts.spotify.com/api/token',
            headers = {
                'Authorization': f'Basic {authorization}',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data={
                'grant_type': 'authorization_code',
                'code': request.GET['code'],
                'redirect_uri': SONGLE_REDIRECT_URI,
            }
        )
        response = response.json()

        # Get access token and refresh token
        access_token = response['access_token']
        refresh_token = response['refresh_token']

        # Query user data
        response = requests.get(
            url = 'https://api.spotify.com/v1/me',
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
            }
        )
        response = response.json()

        # Get username
        username = response['display_name']

        # Return to the index view
        return index(request, username, access_token, refresh_token)


    else:
        # If no code is present, request a code
        request = requests.Request(
            method='GET', 
            url='https://accounts.spotify.com/authorize', 
            params={
                'client_id': os.environ['SONGLE_CLIENT_ID'],
                'response_type': 'code',
                'redirect_uri': SONGLE_REDIRECT_URI,
            }).prepare()
        return HttpResponseRedirect(request.url)

    