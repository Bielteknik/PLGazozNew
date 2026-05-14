
import sys
import os

file_path = "/Users/ejdersoftware/myCodes/ejderFab/software/PLGazozNew/backend/hardware_manager.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "def poll_loop():" in line and i > 300:
        # Start of poll_loop
        new_lines.append(line)
        new_lines.append("                last_in_time = 0\n")
        new_lines.append("                last_out_time = 0\n")
        new_lines.append("                in_low_count = 0\n")
        new_lines.append("                out_low_count = 0\n")
        new_lines.append("                required_stable_polls = 10 \n")
        new_lines.append("                cooldown_s = 0.5\n")
        new_lines.append("                \n")
        new_lines.append("                while self.polling_active:\n")
        new_lines.append("                    try:\n")
        new_lines.append("                        now = time.time()\n")
        new_lines.append("                        in_val = lgpio.gpio_read(self.gpio_h, in_pin)\n")
        new_lines.append("                        if in_val == 0:\n")
        new_lines.append("                            in_low_count += 1\n")
        new_lines.append("                            if in_low_count == required_stable_polls:\n")
        new_lines.append("                                if (now - last_in_time) > cooldown_s:\n")
        new_lines.append("                                    self._handle_input(\"RASPI\")\n")
        new_lines.append("                                    last_in_time = now\n")
        new_lines.append("                        else:\n")
        new_lines.append("                            in_low_count = 0\n")
        new_lines.append("                        \n")
        new_lines.append("                        out_val = lgpio.gpio_read(self.gpio_h, out_pin)\n")
        new_lines.append("                        if out_val == 0:\n")
        new_lines.append("                            out_low_count += 1\n")
        new_lines.append("                            if out_low_count == required_stable_polls:\n")
        new_lines.append("                                if (now - last_out_time) > cooldown_s:\n")
        new_lines.append("                                    self._handle_output(\"RASPI\")\n")
        new_lines.append("                                    last_out_time = now\n")
        new_lines.append("                        else:\n")
        new_lines.append("                            out_low_count = 0\n")
        new_lines.append("                        \n")
        new_lines.append("                        time.sleep(0.01)\n")
        new_lines.append("                    except: break\n")
        skip = True
    elif skip and "self.poll_thread = threading.Thread" in line:
        skip = False
        new_lines.append("\n")
        new_lines.append(line)
    elif not skip:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("File updated successfully")
