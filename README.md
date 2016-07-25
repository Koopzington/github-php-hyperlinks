# GitHub PHP Hyperlinks
[![Install](https://raw.github.com/jerone/UserScripts/master/_resources/Install-button.png)](https://github.com/Koopzington/github-php-hyperlinks/raw/master/github-php-hyperlinks.user.js)
[![Source](https://raw.github.com/jerone/UserScripts/master/_resources/Source-button.png)](https://github.com/Koopzington/github-php-hyperlinks/blob/master/github-php-hyperlinks.user.js)
[![Support](https://raw.github.com/jerone/UserScripts/master/_resources/Support-button.png)](https://github.com/Koopzington/github-php-hyperlinks/issues)

## What is github-php-hyperlinks?
A userscript that enhances browsing through PHP code on GitHub by linking referenced classes!
## So how does it work (and why doesn't it work for my repo)?
The script assumes that your php repo has a composer.json and that you also have either PSR-0 or PSR-4 autoloading defined in it.
Additionaly to that it checks your composer.json's **require** and **require-dev** sections and does a lookup 
on [Packagist](packagist.org) for them (also assuming those packages have a branch or alias named **dev-master** and autoloading 
defined in their composer.json).

Classnames with underscores aren't supported (and i don't really plan to support them. Upgrade your code, m8).
