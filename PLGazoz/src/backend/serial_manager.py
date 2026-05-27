import asyncio
import os
import serial
import serial.tools.list_ports
import threading
import time
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SerialManager")

# Mock RPi.GPIO for non-Raspberry Pi environments (like Windows development)
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    HAS_GPIO = True
    logger.info("RPi.GPIO successfully loaded. Raspberry Pi GPIO control is available.")
except ImportError:
    HAS_GPIO = False
    logger.warning("RPi.GPIO not found. Running in non-Pi mode; Pi GPIO pins will be simulated.")

class SerialManager:
    def __init__(self, event_callback=None, mock_mode=True):
        self.event_callback = event_callback  # Callback to notify main server of sensor events
        self.mock_mode = mock_mode
        self.connections = {
            "Valfler": None,
            "Sensors": None
        }
        self.threads = []
        self.running = False
        self.port_mapping = {} # maps actual COM/tty port to device_id
        
        # Keep track of active output pins on Raspberry Pi 5 GPIO
        self.pi_gpio_states = {}

    def start(self):
        self.running = True
        if self.mock_mode:
            logger.info("SerialManager started in MOCK (simulation) mode.")
            # Start a mock listener thread for simulation inputs
            t = threading.Thread(target=self._mock_event_generator, daemon=True)
            t.start()
            self.threads.append(t)
        else:
            logger.info("SerialManager starting in LIVE hardware mode. Performing discovery...")
            self.discover_and_connect()
            
            # Start listener threads for connected serial devices
            for device_id, ser in self.connections.items():
                if ser and ser.is_open:
                    t = threading.Thread(target=self._serial_listener_loop, args=(device_id, ser), daemon=True)
                    t.start()
                    self.threads.append(t)

    def stop(self):
        self.running = False
        for device_id, ser in self.connections.items():
            if ser and ser.is_open:
                try:
                    ser.close()
                except Exception as e:
                    logger.error(f"Error closing port for {device_id}: {e}")
        
        if HAS_GPIO:
            try:
                GPIO.cleanup()
                logger.info("Raspberry Pi GPIO cleaned up successfully.")
            except Exception as e:
                logger.error(f"Error during GPIO cleanup: {e}")

    def discover_and_connect(self):
        """
        Attempts to scan all active serial/COM ports, performs a WHOAMI handshake,
        and assigns ports to Valfler and Sensors dynamically.
        """
        ports = list(serial.tools.list_ports.comports())
        logger.info(f"Scanning serial ports. Found: {[p.device for p in ports]}")
        
        # On Raspberry Pi, we can also explicitly probe the hardware UART port (/dev/ttyAMA0 or /dev/ttyS0)
        potential_ports = [p.device for p in ports]
        for pi_uart in ["/dev/ttyAMA0", "/dev/ttyS0", "/dev/serial0"]:
            if os.path.exists(pi_uart) and pi_uart not in potential_ports:
                potential_ports.append(pi_uart)

        for port in potential_ports:
            try:
                logger.info(f"Probing port: {port}...")
                ser = serial.Serial(port, baudrate=115200, timeout=1.5)
                time.sleep(1.8) # Wait for Arduino bootloader auto-reset to finish
                
                # Clear input buffer and query whoami
                ser.reset_input_buffer()
                ser.write(b"WHOAMI\n")
                ser.flush()
                
                response = ser.readline().decode('utf-8', errors='ignore').strip()
                logger.info(f"Port {port} returned: '{response}'")
                
                if response.startswith("ID:"):
                    device_id = response.replace("ID:", "").strip()
                    if device_id in self.connections:
                        logger.info(f"MATCH SUCCESS: Port {port} identified as {device_id}!")
                        self.connections[device_id] = ser
                        self.port_mapping[port] = device_id
                    else:
                        logger.warning(f"Unknown device ID '{device_id}' returned from port {port}")
                        ser.close()
                else:
                    logger.warning(f"No valid handshake response on port {port}. Closing port.")
                    ser.close()
            except Exception as e:
                logger.debug(f"Could not open or probe port {port}: {e}")

        # Check what we found
        for device_id, ser in self.connections.items():
            if ser is None:
                logger.warning(f"COULD NOT FIND {device_id} on any serial port. Ensure hardware is plugged in.")
            else:
                logger.info(f"{device_id} is CONNECTED on {ser.port}")

    def update_device_connection(self, device_id: str, port: str, baudrate: int, enabled: bool):
        """
        Dynamically closes any existing serial connection for device_id,
        and if enabled (and not mock), opens a connection on the new port/baudrate,
        performs a WHOAMI handshake to verify the device, and spins up a listener thread.
        """
        if device_id not in self.connections:
            # We only track connections for "Valfler" and "Sensors"
            # RASPI has no serial connection
            return False

        # 1. Close existing connection if any
        old_ser = self.connections.get(device_id)
        if old_ser:
            try:
                logger.info(f"Closing existing connection for device {device_id} on {old_ser.port}...")
                old_ser.close()
            except Exception as e:
                logger.error(f"Error closing old port for {device_id}: {e}")
            self.connections[device_id] = None
            
            # Remove from port mapping
            ports_to_remove = [p for p, dev in self.port_mapping.items() if dev == device_id]
            for p in ports_to_remove:
                del self.port_mapping[p]

        if not enabled:
            logger.info(f"Device {device_id} has been disabled. Connection closed.")
            return True

        if self.mock_mode:
            logger.info(f"[MOCK] Dynamic reconnection for device {device_id} to port {port} at {baudrate} baud (MOCK MODE).")
            return True

        if not port:
            logger.warning(f"No port specified for {device_id}. Skipping connection.")
            return False

        # 2. Try to connect to the new port
        try:
            logger.info(f"Connecting dynamically to {device_id} on port {port} at {baudrate} baud...")
            ser = serial.Serial(port, baudrate=baudrate, timeout=1.5)
            time.sleep(1.8)  # Wait for Arduino bootloader auto-reset to finish
            
            # Clear input buffer and query whoami
            ser.reset_input_buffer()
            ser.write(b"WHOAMI\n")
            ser.flush()
            
            response = ser.readline().decode('utf-8', errors='ignore').strip()
            logger.info(f"Port {port} handshake returned: '{response}'")
            
            if response.startswith("ID:") and response.replace("ID:", "").strip() == device_id:
                logger.info(f"MATCH SUCCESS: Port {port} successfully verified as {device_id}!")
                self.connections[device_id] = ser
                self.port_mapping[port] = device_id
                
                # Start listener thread for this port
                t = threading.Thread(target=self._serial_listener_loop, args=(device_id, ser), daemon=True)
                t.start()
                self.threads.append(t)
                return True
            else:
                logger.warning(f"Handshake mismatch or invalid response '{response}' from port {port}. Closing port.")
                ser.close()
                return False
        except Exception as e:
            logger.error(f"Could not dynamically connect to {device_id} on port {port}: {e}")
            return False

    def write_to_device(self, device_id: str, pin: str, state: str):
        """
        Drives the hardware dynamically based on the device mapping.
        device_id: 'NANO-1', 'NANO-2', or 'RASPI'
        pin: e.g., 'D2', 'GPIO21'
        state: 'ON' or 'OFF'
        """
        logger.info(f"CMD OUT -> Device: {device_id} | Pin: {pin} | State: {state}")
        
        if self.mock_mode:
            # Simulated delay and output
            logger.info(f"[MOCK OUTPUT] {device_id} Pin {pin} set to {state}")
            if device_id == "RASPI":
                self.pi_gpio_states[pin] = (state == "ON")
            return True

        if device_id == "RASPI":
            # Direct control of Raspberry Pi 5 GPIO
            if not HAS_GPIO:
                logger.warning(f"Simulating Pi GPIO {pin} to {state} (RPi.GPIO is not available)")
                self.pi_gpio_states[pin] = (state == "ON")
                return True
                
            try:
                # Convert 'GPIO21' to integer pin number 21
                pin_num = int(pin.lower().replace("gpio", "").strip())
                
                # Initialize pin as output dynamically if not already configured
                if pin_num not in self.pi_gpio_states:
                    GPIO.setup(pin_num, GPIO.OUT)
                    logger.info(f"Configured Pi 5 physical pin GPIO {pin_num} as OUTPUT.")
                
                val = GPIO.HIGH if state == "ON" else GPIO.LOW
                GPIO.output(pin_num, val)
                self.pi_gpio_states[pin] = (state == "ON")
                logger.info(f"Successfully wrote {state} to Pi 5 GPIO {pin_num}.")
                return True
            except Exception as e:
                logger.error(f"Failed to control Raspberry Pi 5 GPIO {pin}: {e}")
                return False

        # UART/USB Serial commands to Nanos
        ser = self.connections.get(device_id)
        if ser and ser.is_open:
            try:
                # Format: VALVE:ON:D2\n or GATE:OPEN:D5\n
                # We map command structure based on whether it is a valve or gate
                cmd_type = "VALVE" if device_id == "NANO-1" else "GATE"
                
                # Solenoid gate has OPEN/CLOSE syntax instead of ON/OFF
                state_syntax = state
                if cmd_type == "GATE":
                    state_syntax = "OPEN" if state == "ON" else "CLOSE"
                
                command = f"{cmd_type}:{state_syntax}:{pin}\n"
                ser.write(command.encode('utf-8'))
                ser.flush()
                logger.debug(f"Wrote to serial: {command.strip()}")
                return True
            except Exception as e:
                logger.error(f"Error writing to {device_id} serial: {e}")
                return False
        else:
            logger.error(f"Cannot write to {device_id}: Port is not open.")
            return False

    def trigger_refill_valve(self, state: str, pin: str = "D10"):
        """Refill valve sits on Valfler by default"""
        logger.info(f"REFILL COMMAND -> State: {state} on Pin: {pin}")
        if self.mock_mode:
            logger.info(f"[MOCK REFILL] Refill valve on {pin} set to {state}")
            return True
            
        ser = self.connections.get("Valfler")
        if ser and ser.is_open:
            try:
                # Format: REFILL:ON:D10\n or REFILL:OFF:D10\n
                command = f"REFILL:{state}:{pin}\n"
                ser.write(command.encode('utf-8'))
                ser.flush()
                return True
            except Exception as e:
                logger.error(f"Error writing refill to Valfler: {e}")
                return False
        return False

    def trigger_ultrasonic_read(self, trigger_pin: str, echo_pin: str):
        """Triggers Sensors to perform HC-SR04 reading"""
        if self.mock_mode:
            # Returns a mock distance in mm
            return 150 # 150mm distance
            
        ser = self.connections.get("Sensors")
        if ser and ser.is_open:
            try:
                command = f"READ:HCSR04:{trigger_pin}:{echo_pin}\n"
                ser.write(command.encode('utf-8'))
                ser.flush()
                return True
            except Exception as e:
                logger.error(f"Error writing read request to Sensors: {e}")
                return False
        return False

    def _serial_listener_loop(self, device_id: str, ser: serial.Serial):
        """Listens to lines coming from serial port in a thread loop"""
        logger.info(f"Started asynchronous serial listener thread for {device_id}")
        
        while self.running and ser.is_open:
            try:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                    
                    logger.info(f"LINE IN <- {device_id}: '{line}'")
                    
                    # Parse Event: EVENT:PIN:D2:ACTIVE\n
                    if line.startswith("EVENT:"):
                        self._handle_incoming_event(device_id, line)
            except Exception as e:
                logger.error(f"Error reading from serial loop {device_id}: {e}")
                time.sleep(1) # Back off briefly on error
            time.sleep(0.01)

    def _handle_incoming_event(self, device_id: str, event_line: str):
        """
        Parses incoming serial messages and translates them to callbacks
        Example: EVENT:PIN:D2:ACTIVE
        Example: EVENT:HCSR04:145 (Nano 2 returns HC-SR04 distance measurement)
        """
        parts = event_line.split(":")
        # parts: ['EVENT', 'PIN', 'D2', 'ACTIVE']
        # parts: ['EVENT', 'HCSR04', '145']
        
        if len(parts) >= 3:
            event_type = parts[1]
            if event_type == "PIN":
                pin = parts[2]
                status = parts[3] if len(parts) > 3 else "ACTIVE"
                if self.event_callback:
                    self.event_callback(device_id, pin, status)
            elif event_type == "HCSR04":
                distance_mm = int(parts[2])
                if self.event_callback:
                    # Notify distance update
                    self.event_callback(device_id, "HCSR04", distance_mm)

    def _mock_event_generator(self):
        """
        Generates simulated physical events (bottle counts) when in mock mode
        and when certain digital doors (gates) are opened.
        """
        logger.info("Mock event generator loop is running.")
        
        # State machine values to coordinate mock flow
        # In a real run, this mirrors conveyor movement
        last_in_gate_state = False
        last_out_gate_state = False
        
        while self.running:
            # Let's check the current virtual gate configurations or trigger mock events dynamically
            # If the entry gate (mapped to NANO-2, pin D5 by default) is "OPEN"
            # and we are in AUTOMATIC mode, simulate bottles entering one by one!
            
            # This logic will be coordinated by the main FastAPI server who triggers mock events
            # or sets mock states. For simple standalone testing, we just sleep.
            time.sleep(0.1)
            
    def simulate_mock_sensor_trigger(self, sensor_type: str):
        """Force a mock sensor event (e.g. SENS-IN, SENS-OUT) for testing"""
        if not self.mock_mode or not self.event_callback:
            return
            
        if sensor_type == "IN":
            # Mock Entry bottle laser beam interruption
            logger.info("[MOCK EVENT] Simulating Bottle entered SENS-IN laser beam.")
            self.event_callback("NANO-2", "D2", "ACTIVE")
        elif sensor_type == "OUT":
            # Mock Exit bottle laser beam interruption
            logger.info("[MOCK EVENT] Simulating Bottle exited SENS-OUT laser beam.")
            self.event_callback("NANO-2", "D3", "ACTIVE")
        elif sensor_type == "LEVEL":
            # Mock Ultrasonic height reading
            # Return some random realistic height
            import random
            mock_dist = random.randint(145, 155)
            logger.info(f"[MOCK EVENT] Simulating HC-SR04 distance reading: {mock_dist}mm")
            self.event_callback("NANO-2", "HCSR04", mock_dist)
