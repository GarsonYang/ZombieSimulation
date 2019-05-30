# Zombie Simulator

This repository contains code for a simple agent-based simulation of a zombie attack, created for the _Software Architecture_ course at the UW iSchool.

In this Zombie Simulator, agents are running around the city. Agents currently have 4 different states: NormalHuman (Red), SickHuman (Purple), PanickedHuman (Yellow), and Zombie (Green). A NormalHuman bitten by a zombie becomes a SickHuman. A SickHuman turn into a Zombie after some time. A NormalHuman sees a zombie and becomes a PanickedHuman. Since agents in different states behaves differently and states are frequently interchanging, we used State Pattern to facilitate the transition and manage behaviors.

We used Composite pattern to build the game map. Component abstract class is created to represent part-whole hierarchies. Current design is: City has Buildings and Building has Rooms (Not in the requirement, but we add this to show the code is easily extensible). 

Finally, we used Strategy pattern to decorate the buildings and rooms. We created a ILightStrategy interface and each component has a IlightStrategy to specify the lighting condition of this location. There are two concrete strategy classes implementing ILightStrategy interface: NormalLight and DarkLight. Both classes explicitly describe the environment in the specific lighting condition using getVisionDistance() funciton and getOpacity() function. We chose Strategy as the pattern to decorate buildings because the problem we are facing is to add other types of environments in buildings. We feel Strategy is more suitable to use here than State pattern because the environments are more 'stable' and do not require frequent changes which is what State is used for.

Have fun watching the zombies bite!!!
