# Farmworker Services map

https://cornell-farmworker.github.io/farmworker-services/

A simple, searchable point map of Farmworker Services in New York State, powered by a CSV file, and designed to work on both large monitors and small devices.

This is a project of the [Cornell Farmworker Program](https://cardi.cals.cornell.edu/programs/farmworker/)


## Cleaning up data in Google Sheets

Invisible extra spaces at the beginning or end of a value in a table cell can cause problems.  In Google Sheets, we can use the search-and-replace function to find these and replace them:

* Edit menu > Find and replace (or press CTRL-H)
* Find: `\s+$` (in regular expressions, `\s` means any space-like character, `+` means find one or more, `$` means the end of the value)
* Check the box to "Search using regular expressions"

Click the "Find" button just to make sure the regular expression is correct.  If it doesn't find anything, check your query.  It may also be that there are no trailing spaces.

* "Replace with" should be set to nothing, since we just want to remove the trailing spaces.
* Click Replace All (or keep clicking "Replace" if you would rather review each replacement.

Always be careful when running a "replace all" operation!  If something goes wrong, you should be able to undo it right away.

You can also search and replace any leading spaces with this regular expression: `^\s+` (`^` means the beginning of the value)
