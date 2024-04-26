async function fetchTruckInfo() {
    const plateNumber = document.getElementById('truckPlate').value.trim(); // Trim any leading/trailing whitespace
    if (!plateNumber) {
        displayErrorMessage('Please enter a plate number.');
        return;
    }
    try {
        const response = await fetch(`/api/trucks?plate=${plateNumber}`);
        if (!response.ok) {
            if (response.status === 404) {
                displayErrorMessage('No truck found with the entered plate number.');
            } else {
                throw new Error('Network response was not ok');
            }
        } else {
            const truckInfo = await response.json();
            if (Object.keys(truckInfo).length === 0) {
                displayErrorMessage('No truck found with the entered plate number.');
            } else {
                displayTruckInfo(truckInfo);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayTruckInfo(truckInfo) {
    const truckInfoDisplay = document.getElementById('truckInfoDisplay');
    const errorMessageElement = document.getElementById('errorMessage');

    // Display truck information
    truckInfoDisplay.innerHTML = `
        <p>Year: ${truckInfo.Year}</p>
        <p>Make: ${truckInfo.Make}</p>
        <p>Model: ${truckInfo.Model}</p>
        <p>Tare Weight: ${truckInfo.TareWeight}</p>
        <p>Trailer: ${truckInfo.Trailer}</p>
        ${truckInfo.Trailer === 'flatbed' ? `<p>Flatbed Length: ${truckInfo.FlatbedLength}</p>` : ''}
        <p>Equipment Number: ${truckInfo.EquipmentNumber}</p>
        <p>Fuel Mileage: ${truckInfo.FuelMileage}</p>
        <p>Fuel Capacity: ${truckInfo.FuelCapacity}</p>
    `;

    // Clear any existing error message
    errorMessageElement.textContent = '';
}


function displayErrorMessage(message) {
    const errorMessageElement = document.getElementById('errorMessage');
    errorMessageElement.textContent = message;
}


function calculate() {
    // Get input values
    const loadType = document.getElementById('loadType').value;
    const pickUps = parseInt(document.getElementById('pickUps').value);
    const dropOffs = parseInt(document.getElementById('dropOffs').value);
    const price = parseFloat(document.getElementById('price').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const mileage = parseFloat(document.getElementById('mileage').value);

    // Perform calculations
    const fuelCost = mileage * 4.50;
    const totalPrice = price * mileage;
    const profit = totalPrice - fuelCost;
    const totalWeight = weight + parseInt(document.getElementById('tareWeight').textContent);

    // Display the results
    const tableBody = document.getElementById('comparisonTableBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${loadType}</td>
        <td>${pickUps}</td>
        <td>${dropOffs}</td>
        <td>${price}</td>
        <td>${weight}</td>
        <td>${mileage}</td>
        <td>${fuelCost}</td>
        <td>${totalPrice}</td>
        <td>${profit}</td>
        <td>${totalWeight}</td>
    `;
    tableBody.appendChild(newRow);
}

function addLoad() {
    // Clear input fields for a new load
    document.getElementById('loadType').selectedIndex = 0;
    document.getElementById('pickUps').value = '';
    document.getElementById('dropOffs').value = '';
    document.getElementById('price').value = '';
    document.getElementById('weight').value = '';
    document.getElementById('mileage').value = '';
}

function emptyTable() {
    // Remove all rows from the table
    const tableBody = document.getElementById('comparisonTableBody');
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }
}

