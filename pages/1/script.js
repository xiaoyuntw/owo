const photo = document.getElementById("photo");
const preview = document.getElementById("preview");
const save = document.getElementById("save");
const productList = document.getElementById("productList");


// 選擇照片
photo.addEventListener("change", function() {

    const file = photo.files[0];

    if (file) {

        const reader = new FileReader();

        reader.onload = function(e) {
            preview.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

});


// 儲存資料
save.addEventListener("click", function() {

    const name = document.getElementById("name").value;
    const brand = document.getElementById("brand").value;
    const expiry = document.getElementById("expiry").value;

    const product = {
        name: name,
        brand: brand,
        expiry: expiry,
        photo: preview.src
    };

    let products = JSON.parse(localStorage.getItem("products")) || [];

    products.push(product);

    localStorage.setItem("products", JSON.stringify(products));

    showProducts();

});


// 顯示所有化妝品
function showProducts() {

    productList.innerHTML = "";

    let products = JSON.parse(localStorage.getItem("products")) || [];

    products.forEach(function(product, index) {

        productList.innerHTML += `
            <div>
                <img src="${product.photo}" width="200">

                <h2>${product.name}</h2>

                <p>品牌：${product.brand}</p>

                <p>保存期限：${product.expiry}</p>

                <button class="editButton" data-index="${index}">
    修改
</button>

<button class="deleteButton" data-index="${index}">
    刪除
</button>

                <hr>
            </div>
        `;

    });

    // 找到所有刪除按鈕
    const deleteButtons = document.querySelectorAll(".deleteButton");
    const editButtons = document.querySelectorAll(".editButton");
    editButtons.forEach(function(button) {

        button.addEventListener("click", function() {
    
            const index = button.dataset.index;
    
            editProduct(index);
    
        });
    
    });

    // 幫每個刪除按鈕加入點擊功能
    deleteButtons.forEach(function(button) {

        button.addEventListener("click", function() {

            const index = button.dataset.index;

            deleteProduct(index);

        });

    });

}


// 刪除化妝品
function deleteProduct(index) {

    let products = JSON.parse(localStorage.getItem("products")) || [];

    products.splice(index, 1);

    localStorage.setItem("products", JSON.stringify(products));

    showProducts();

}
function editProduct(index) {

    let products = JSON.parse(localStorage.getItem("products")) || [];

    const newName = prompt("請輸入新的產品名稱：", products[index].name);

    const newBrand = prompt("請輸入新的品牌：", products[index].brand);

    const newExpiry = prompt("請輸入新的保存期限：", products[index].expiry);

    if (newName !== null) {
        products[index].name = newName;
    }

    if (newBrand !== null) {
        products[index].brand = newBrand;
    }

    if (newExpiry !== null) {
        products[index].expiry = newExpiry;
    }

    localStorage.setItem("products", JSON.stringify(products));

    showProducts();
}


// 網頁開啟時，顯示已儲存資料
showProducts();
