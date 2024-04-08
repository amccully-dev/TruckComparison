async function fetchTruckInfo() {
    const plateNumber = document.getElementById('truckPlate').value;
    try {
        const response = await fetch(`/api/trucks?plate=${plateNumber}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const truckInfo = await response.json();
        // Display the truck information if found, otherwise display an error message
        if (Object.keys(truckInfo).length === 0) {
            displayErrorMessage('No truck found. Please check entered information.');
        } else {
            displayTruckInfo(truckInfo);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayTruckInfo(truckInfo) {
    const truckInfoDisplay = document.getElementById('truckInfoDisplay');
    truckInfoDisplay.innerHTML = `
        <p>Year: ${truckInfo.Year}</p>
        <p>Make: ${truckInfo.Make}</p>
        <p>Model: ${truckInfo.Model}</p>
        <p>Tare Weight: ${truckInfo.TareWeight}</p>
        <p>Trailer: ${truckInfo.Trailer}</p>
        <p>Flatbed Length: ${truckInfo.FlatbedLength}</p>
        <p>Equipment Number: ${truckInfo.EquipmentNumber}</p>
        <p>Fuel Mileage: ${truckInfo.FuelMileage}</p>
        <p>Fuel Capacity: ${truckInfo.FuelCapacity}</p>
    `;
}

function displayErrorMessage(message) {
    const truckInfoDisplay = document.getElementById('truckInfoDisplay');
    truckInfoDisplay.innerHTML = `<p>${message}</p>`;
}

function toggleAddTruckForm() {
    const addTruckFormContainer = document.getElementById('addTruckFormContainer');
    if (addTruckFormContainer.style.display === 'none') {
        addTruckFormContainer.style.display = 'block';
    } else {
        addTruckFormContainer.style.display = 'none';
    }
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

function toggleFlatbedLength() {
    const trailer = document.getElementById('trailer').value;
    const flatbedLengthContainer = document.getElementById('flatbedLengthContainer');
    if (trailer === 'flatbed') {
        flatbedLengthContainer.style.display = 'block';
    } else {
        flatbedLengthContainer.style.display = 'none';
    }
}

// Fetch password reset questions from server and populate the dropdown
async function populateResetQuestions() {
    try {
      const response = await fetch('/passwordResetQuestions');
      if (!response.ok) {
        throw new Error('Failed to fetch password reset questions');
      }
      const questions = await response.json();
      const selectElement = document.getElementById('resetQuestion');
      selectElement.innerHTML = ''; // Clear existing options
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a question';
      selectElement.appendChild(defaultOption);
      // Add fetched questions
      questions.forEach(question => {
        const option = document.createElement('option');
        option.value = question;
        option.textContent = question;
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error('An error occurred while fetching password reset questions:', error);
    }
  }
  
  // Call the function to populate password reset questions on page load
  populateResetQuestions();
  
  
  