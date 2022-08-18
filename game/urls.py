from django.urls import path

from . import views

app_name = 'game'

urlpatterns = [
    path('', views.index, name='index'),
    path('<int:game_id>', views.game, name='game'),
    path('creategame', views.create_game, name='create-game'),
    path('joingame', views.join_game, name='join-game'),
    path('spotifyauthorize', views.authorize, name='spotify-authorize'),
]