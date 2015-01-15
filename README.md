<img src="http://s9.postimg.org/mqolutoxb/amheader.png">

![](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/animachine/animachine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

The animachine is a GUI for GSAP. 
It lets you to create code driven animation using traditional animation tools (timeline, transformtool, etc.).
You don't need to add any change to your project for using animachine, just hit on the [chrome plugin][extension] or embed like any other js library and start animating.

###Why is this needed?
You have great tools to make animations for the web (like Adobe Edge, Google Webdesigner or Animatron) but all of these are only for making sandboxed animations and embed that boxes in somewhere (usually in an iframe). If you need to animate some inner part of your project (ex. when a dialog appears or a game character jumps and walks) it's has to be coded by a programmer. When this animations have to be long, artistic or just done by somebody how is not a skilled programmer this work can be tedious or almost impossible, so this can prevent us from seeing more fine and shopisticated animations on the web.

###How is this working?
In a nuteshell, when you click on the extension you'll have an overlay on your page with the animation tools witch you'll be familiar with if you ever made animations with prgrams like Anime Studio, Adobe Edge, Affter Effects etc.  
Then you can pick elements from your page and start animating them.  
When it's done, you can save your animation as a .js file an include it in your page.  
If later you want to change your animation, just open the animachine, load that .js file and you can continue where you stoped.  

###What the state of this?
We're working for reach the beta state, so you can start to use it in you projects, but currently it's in alpha, so things changing day from day, many of the basic features are just draft, the save files from last week probably don't gonna work in the next week. Although you're wellcomed to play with the [extension], the demos and take the in app tours.

###Demos: [1][demo1], ...(wip)
###Tours:  ...(wip)

###Milestones
**1,**  
Add all the the best basic timeline editing features, what we love from the good old animation tools. 
Make the UI more intuitive.  
Create in app tours for the different features. (quick start, using timeline, css track, etc.)   
Enable Undo/Redo functionality.  
Add more available track types for editing ~~css~~, attributes, mediaelements.  
Random key values.  
Css Transform3D support.  

**2,**  
Extended support for svg animation. (paths, filters, etc.)  
Pixi.js, Easel.js, Raphael.js, Kinetic.js, support.  
Resource handling and content creating.  
Animating with skeletons.  
Support sprite sheets.  
Video file export.  


**3,**  
Three.js support.  
Create online playground.  

[extension]: https://chrome.google.com/webstore/detail/animachine/gpnfomkfgajaojpakbkikiekmajeojgd
[demo1]: http://animachine.github.io/animachine/demos/marspolip/
