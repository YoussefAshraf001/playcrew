# PlayCrew Playnite integration

This extension sends each completed Playnite game session to PlayCrew Desktop. PlayCrew opens (or restores from the tray), adds the session duration to the uniquely name-matched library game, and displays a toast.

## Install

1. Install and run a PlayCrew Desktop build containing this integration once. This registers the `playcrew://` Windows protocol.
2. Double-click the generated `PlayCrew_Playnite_...pext` file and approve its installation in Playnite. For a source install, copy this `playnite` folder into `%AppData%\Playnite\Extensions\PlayCrewPlaytime` (portable Playnite: `<Playnite folder>\Extensions\PlayCrewPlaytime`).
3. If you used the source-install option, choose **Main menu → Extensions → Reload Scripts**, or restart Playnite.

The PlayCrew library must contain exactly one game with the same name as the Playnite game. Sessions that cannot be matched are not written, and PlayCrew explains why in the toast.
