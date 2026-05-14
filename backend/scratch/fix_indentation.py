
import sys

file_path = "/Users/ejdersoftware/myCodes/ejderFab/software/PLGazozNew/backend/main.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Lines 437 to 473 (0-indexed: 436 to 472)
    # We want to remove 4 spaces from the beginning if they are there
    if 436 <= i <= 472:
        if line.startswith("                "):
            new_lines.append(line[4:])
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("Main.py indentation fixed")
