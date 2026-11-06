const mongoose = require("mongoose");
const { DiscountEngine } = require("./plugin/ecommerce-plugin/src/services/DiscountEngine");
const { CustomDiscountEvaluator } = require("./plugin/ecommerce-plugin/src/services/CustomDiscountEvaluator");

async function runTests() {
   console.log("Mocking dependencies for tests...");
   const mockProduct = { _id: "p1", name: "Mock Product", price: 1000, stock: 10, status: "Published" };
   const ProductModel = { findById: async () => mockProduct };

   const rule1 = {
      _id: "r1", name: "Test 1: 500 off cart", type: "custom", status: "Active",
      customConfig: {
         conditionTree: { operator: "AND", conditions: [{ type: "CartTotal", operator: ">=", value: 5000 }] },
         actions: [{ type: "FixedAmountOff", amount: 500, applyTo: "EntireCart" }]
      }
   };
   
   const rule2 = {
      _id: "r2", name: "Test 2: Tuesday Books 20%", type: "custom", status: "Active",
      customConfig: {
         conditionTree: { 
            operator: "AND", 
            conditions: [{ type: "DayOfWeek", operator: "Any Of", value: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"] }, { type: "CategoryInCart", operator: "Contains", value: ["cat1"] }] 
         },
         actions: [{ type: "PercentageOff", percentage: 20, applyTo: "Category", categoryIds: ["cat1"] }]
      }
   };

   let items1 = [{ productId: "p1", categoryId: "cat2", quantity: 6, price: 1000, remainingPrice: 1000, originalPrice: 1000 }];
   
   console.log("--- TEST 1: Cart Total >= 5000 -> 500 Off ---");
   let ctx1 = { items: items1, evaluationSubtotal: 6000 };
   let pass1 = CustomDiscountEvaluator.evaluateConditions(rule1.customConfig.conditionTree, ctx1);
   console.log("Condition matched?", pass1);
   if (pass1) {
       let res1 = await CustomDiscountEvaluator.executeActions(rule1.customConfig.actions, items1, rule1, ProductModel);
       console.log("Discount Applied:", res1.ruleTotalAmount);
   }

   console.log("--- TEST 2: Category Books -> 20% Off ---");
   let items2 = [{ productId: "p2", categoryId: "cat1", quantity: 1, price: 5000, remainingPrice: 5000, originalPrice: 5000 }];
   let ctx2 = { items: items2, evaluationSubtotal: 5000 };
   let pass2 = CustomDiscountEvaluator.evaluateConditions(rule2.customConfig.conditionTree, ctx2);
   console.log("Condition matched?", pass2);
   if (pass2) {
       let res2 = await CustomDiscountEvaluator.executeActions(rule2.customConfig.actions, items2, rule2, ProductModel);
       console.log("Discount Applied:", res2.ruleTotalAmount);
   }
   
   console.log("--- TEST 6: Nested Logic A AND (B OR C) ---");
   const rule6 = {
      customConfig: {
         conditionTree: {
             operator: "AND",
             conditions: [
                 { type: "CartTotal", operator: ">=", value: 5000 },
                 { operator: "OR", conditions: [
                     { type: "ProductQuantity", product: "p1", operator: ">=", value: 2 },
                     { type: "CategoryInCart", operator: "Contains", value: ["cat3"] }
                 ]}
             ]
         }
      }
   };
   let pass6_success = CustomDiscountEvaluator.evaluateConditions(rule6.customConfig.conditionTree, { items: [{productId: "p1", quantity: 3}], evaluationSubtotal: 6000 });
   let pass6_fail = CustomDiscountEvaluator.evaluateConditions(rule6.customConfig.conditionTree, { items: [{productId: "p1", quantity: 1}], evaluationSubtotal: 6000 });
   console.log("Match success:", pass6_success, "(Expected true)");
   console.log("Match fail:", pass6_fail, "(Expected false)");

   console.log("Done.");
}
runTests();
