export class CustomDiscountEvaluator {
  static evaluateConditions(conditionTree: any, context: any): boolean {
    if (!conditionTree || !conditionTree.operator || !Array.isArray(conditionTree.conditions)) return true;
    if (conditionTree.conditions.length === 0) return true;

    if (conditionTree.operator === 'AND') {
      for (const cond of conditionTree.conditions) {
        if (!this.evaluateCondition(cond, context)) return false;
      }
      return true;
    } else if (conditionTree.operator === 'OR') {
      for (const cond of conditionTree.conditions) {
        if (this.evaluateCondition(cond, context)) return true;
      }
      return false;
    }
    return false;
  }

  static evaluateCondition(cond: any, context: any): boolean {
    if (cond.operator === 'AND' || cond.operator === 'OR') {
      return this.evaluateConditions(cond, context); 
    }

    const { items, evaluationSubtotal, city } = context;
    const now = new Date();

    const compareNum = (val: number, op: string, target: any) => {
        const numTarget = Number(target);
        if (op === '=') return val === numTarget;
        if (op === '>') return val > numTarget;
        if (op === '>=') return val >= numTarget;
        if (op === '<') return val < numTarget;
        if (op === '<=') return val <= numTarget;
        if (op === 'Between' && Array.isArray(target)) return val >= Number(target[0]) && val <= Number(target[1]);
        return false;
    };

    switch (cond.type) {
      case 'CartTotal':
        return compareNum(evaluationSubtotal, cond.operator, cond.value);
      
      case 'CartItemCount':
        const distinctItemsCount = items.length;
        return compareNum(distinctItemsCount, cond.operator, cond.value);
        
      case 'TotalCartQuantity':
        const totalQty = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        return compareNum(totalQty, cond.operator, cond.value);
        
      case 'ProductInCart':
        if (!cond.value || !Array.isArray(cond.value)) return false;
        const itemMatch = items.some((item: any) => cond.value.includes(String(item.productId)));
        if (cond.operator === 'Contains') return itemMatch;
        if (cond.operator === 'Does Not Contain') return !itemMatch;
        if (cond.operator === 'Any Of') return itemMatch;
        if (cond.operator === 'All Of') {
             return cond.value.every((id: any) => items.some((item: any) => String(item.productId) === String(id)));
        }
        return false;
        
      case 'CategoryInCart':
        if (!cond.value || !Array.isArray(cond.value)) return false;
        const catMatch = items.some((item: any) => cond.value.includes(String(item.categoryId)));
        if (cond.operator === 'Contains') return catMatch;
        if (cond.operator === 'Does Not Contain') return !catMatch;
        if (cond.operator === 'Any Of') return catMatch;
        if (cond.operator === 'All Of') {
             return cond.value.every((id: any) => items.some((item: any) => String(item.categoryId) === String(id)));
        }
        return false;

      case 'ProductQuantity':
        const matchingItems = items.filter((item: any) => String(item.productId) === String(cond.product));
        const qty = matchingItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        return compareNum(qty, cond.operator, cond.value);

      case 'DayOfWeek':
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = dayNames[now.getDay()];
        if (cond.operator === 'Is') return cond.value === currentDay;
        if (cond.operator === 'Is Not') return cond.value !== currentDay;
        if (cond.operator === 'Any Of') return Array.isArray(cond.value) && cond.value.includes(currentDay);
        return false;
        
      case 'Date':
        const targetDate = new Date(cond.value);
        if (cond.operator === 'On') return now.toDateString() === targetDate.toDateString();
        if (cond.operator === 'Before') return now < targetDate;
        if (cond.operator === 'After') return now > targetDate;
        return false;
        
      case 'DateRange':
        if (!cond.value || !cond.value.start || !cond.value.end) return false;
        const start = new Date(cond.value.start);
        const end = new Date(cond.value.end);
        return now >= start && now <= end;
        
      case 'Time':
        if (!cond.value) return false;
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const parseTime = (t: string) => { const [h, m] = t.split(':'); return parseInt(h)*60 + parseInt(m); };
        if (cond.operator === 'Before') return currentMins < parseTime(cond.value);
        if (cond.operator === 'After') return currentMins > parseTime(cond.value);
        if (cond.operator === 'Between' && Array.isArray(cond.value)) {
           return currentMins >= parseTime(cond.value[0]) && currentMins <= parseTime(cond.value[1]);
        }
        return false;
        
      case 'Location':
        if (!city) return false;
        if (cond.locationField === 'City') {
           const cName = city.split(',')[0].trim().toLowerCase();
           return cName === String(cond.value).toLowerCase();
        }
        return false;

      default:
        return false;
    }
  }

  static async executeActions(actions: any[], items: any[], rule: any, ProductModel: any): Promise<any> {
    let ruleTotalAmount = 0;
    const progressNotices: string[] = [];
    const meta: any = { isFreeShipping: false, addedFreeGifts: [] };

    for (const action of actions) {
      if (action.type === 'PercentageOff') {
        const pct = Math.min(100, Math.max(0, Number(action.percentage) || 0)) / 100;
        let actionAmount = 0;
        
        for (const item of items) {
          if (item.remainingPrice <= 0) continue;
          
          if (action.applyTo === 'SpecificProduct' || action.applyTo === 'MultipleProducts') {
             if (!action.productIds || !action.productIds.includes(String(item.productId))) continue;
          } else if (action.applyTo === 'Category') {
             if (!action.categoryIds || !action.categoryIds.includes(String(item.categoryId))) continue;
          }
          
          const discount = item.remainingPrice * pct;
          item.remainingPrice -= discount;
          actionAmount += (discount * item.quantity);
        }
        
        if (action.maxDiscount && actionAmount > action.maxDiscount) {
            actionAmount = action.maxDiscount;
        }
        ruleTotalAmount += actionAmount;
      }
      
      else if (action.type === 'FixedAmountOff') {
        const amt = Number(action.amount) || 0;
        let eligibleSubtotal = 0;
        const eligibleItems = [];
        
        for (const item of items) {
          if (item.remainingPrice <= 0) continue;
          
          if (action.applyTo === 'SpecificProduct' || action.applyTo === 'MultipleProducts') {
             if (!action.productIds || !action.productIds.includes(String(item.productId))) continue;
          } else if (action.applyTo === 'Category') {
             if (!action.categoryIds || !action.categoryIds.includes(String(item.categoryId))) continue;
          }
          
          eligibleSubtotal += (item.remainingPrice * item.quantity);
          eligibleItems.push(item);
        }
        
        const discountToApply = Math.min(amt, eligibleSubtotal);
        if (discountToApply > 0) {
           for (const item of eligibleItems) {
               const weight = (item.remainingPrice * item.quantity) / eligibleSubtotal;
               const itemDiscount = discountToApply * weight;
               item.remainingPrice -= (itemDiscount / item.quantity);
           }
           ruleTotalAmount += discountToApply;
        }
      }
      
      else if (action.type === 'FreeShipping') {
        meta.isFreeShipping = true;
      }
      
      else if (action.type === 'SetProductPrice') {
        const newPrice = Number(action.newPrice) || 0;
        for (const item of items) {
           if (item.remainingPrice <= 0) continue;
           if (!action.productIds || !action.productIds.includes(String(item.productId))) continue;
           
           if (item.remainingPrice > newPrice) {
               const discountPerUnit = item.remainingPrice - newPrice;
               item.remainingPrice = newPrice;
               ruleTotalAmount += (discountPerUnit * item.quantity);
           }
        }
      }
      
      else if (action.type === 'FreeProduct') {
         const targetId = action.rewardProductId;
         const qty = Number(action.quantity) || 1;
         
         let freeProductValue = 0;
         let availableMultipliers = qty;
         
         for (const item of items) {
             if (availableMultipliers <= 0) break;
             if (String(item.productId) === String(targetId) && item.remainingPrice > 0) {
                 const qtyToFree = Math.min(item.quantity, availableMultipliers);
                 const freeValue = item.remainingPrice * qtyToFree;
                 if (freeValue > 0) {
                     freeProductValue += freeValue;
                     availableMultipliers -= qtyToFree;
                     item.remainingPrice -= (freeValue / item.quantity);
                 }
             }
         }
         
         if (availableMultipliers > 0 && action.autoAdd) {
             try {
                 const product = await ProductModel.findById(targetId);
                 if (product && product.status === 'Published' && product.stock > 0) {
                     const finalQty = Math.min(availableMultipliers, product.stock);
                     items.push({
                         productId: product._id,
                         categoryId: product.categoryId,
                         name: product.name,
                         price: product.price,
                         originalPrice: product.price,
                         quantity: finalQty,
                         remainingPrice: 0,
                         appliedDiscounts: [],
                         isAutoAddedGift: true
                     });
                     freeProductValue += (product.price * finalQty);
                     meta.addedFreeGifts.push({ productId: targetId, quantity: finalQty, productName: product.name, originalPrice: product.price });
                 }
             } catch (e) {}
         }
         
         if (freeProductValue > 0) ruleTotalAmount += freeProductValue;
      }
    }
    
    return { ruleTotalAmount, meta, progressNotices };
  }
}

