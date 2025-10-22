import matplotlib.pyplot as plt

# Temperature (°C) and corresponding average viscosities (Pa·s)
T = [35, 40, 45, 50, 55]
eta = [0.472, 0.436, 0.275, 0.248, 0.198]

# Plot viscosity vs temperature
plt.figure(figsize=(6,4))
plt.plot(T, eta, marker='o', color='royalblue', linestyle='-')
plt.title("Viscosity of Castor Oil vs Temperature")
plt.xlabel("Temperature (°C)")
plt.ylabel("Viscosity η (Pa·s)")
plt.grid(True, linestyle='--', alpha=0.6)
plt.tight_layout()
plt.show()
