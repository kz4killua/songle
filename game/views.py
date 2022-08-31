import os
import base64

from django.http import HttpResponseRedirect, JsonResponse
import requests

from django.shortcuts import render


SONGLE_REDIRECT_URI = 'https://songle.up.railway.app/game/spotifyauthorize'


def index(request, user_data=None):
    return render(request, "game/index.html", user_data)


def game(request, game_id, playlist=None):
    # Render the game template.
    return render(request, "game/game.html", {
        'game_id': game_id,
        'username': request.GET['username'],
        'user_id': request.GET['user_id'],
        'playlist': playlist,
        'access_token': request.GET['access_token'],
        'refresh_token': request.GET['refresh_token'],
    })


def create_game(request):
    return game(request, request.GET['user_id'], request.GET['playlist'])


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

        # Save access and refresh tokens
        access_token = response['access_token']
        refresh_token = response['refresh_token']

        # Query user data
        response = requests.get(
            url = 'https://api.spotify.com/v1/me',
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {response["access_token"]}',
            }
        )
        response = response.json()

        # Gather user data
        user_data = {
            'username': response['display_name'],
            'user_id': response['id'],
            'access_token': access_token,
            'refresh_token': refresh_token,
        }

        # Return to the index view
        return index(request, user_data)


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
